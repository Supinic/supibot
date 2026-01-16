import * as z from "zod";
import { SupiError } from "supi-core";
import type { MapEntries } from "../utils/ts-helpers.js";

type ConstructorOptions = {
	host: string;
	port: number;
};
type MpvStatus = {
	current: null | {
		id: number;
		url: string;
		user: number | null;
		name: string | null;
		playing: boolean;
	};
	paused: boolean;
	playlistCount: number;
	position: number | null;
	duration: number | null;
};
type MpvItem = {
	id: number;
	url: string;
	user: number | null;
	name: string | null;
	duration: number | null;
};

export type MpvPlaylistItem = MpvItem & {
	index: number;
	playing: boolean;
	current: boolean;
};
type MediaRequest = {
	pid: DatabaseMediaRequestRow["PID"];
	url: DatabaseMediaRequestRow["URL"];
	name: DatabaseMediaRequestRow["Name"];
	user: DatabaseMediaRequestRow["Requester"];
	duration: DatabaseMediaRequestRow["Duration"];
};
type DatabaseMediaRequestRow = {
	PID: number;
	URL: string;
	Name: string | null;
	Requester: number | null;
	Duration: number | null;
};

type AddOptions = {
	user?: number | null;
	duration?: number | null;
	name?: string | null;
	startTime?: number;
	endTime?: number;
};

type Failure = {
	success: false;
	reason: string;
};
type Success = { success: true; };

type AddSuccess = Success & {
	id: number;
	/** Time until the added media file plays, in seconds */
	timeUntil: number;
};
type RemoveSuccess = Success & {
	id: number;
	order: number;
	url: string;
	user: number | null;
	name: string | null;
};

const ITEM_DATA_CACHE_KEY = "mpv-item-data";
const PROPERTY_NA = "property unavailable";
const TIMED_OUT_REGEX = /^MPV request #\d+ timed out$/;

const dataSchemas = {
	generic: z.object({
		data: z.unknown(),
		request_id: z.int().optional(),
		error: z.string()
	}),

	add: z.object({ playlist_entry_id: z.int() }),
	duration: z.number(),
	position: z.number(),
	playlistCount: z.int(),
	pause: z.boolean(),
	playlist: z.object({
		data: z.array(z.object({
			id: z.int(),
			filename: z.string(),
			playing: z.boolean().optional(),
			current: z.boolean().optional()
		}))
	})
};

export class MpvClient {
	private readonly host: string;
	private readonly port: number;
	private readonly itemData = new Map<number, MpvItem>();
	private readonly finishedSongPlaylistClearInterval = setInterval(() => void this.trimPlaylist(), 500);

	private running: boolean = false;
	private lastStatus: MpvStatus | null = null;
	private static loggingTableExists: boolean | null = null;

	public constructor (options: ConstructorOptions) {
		this.host = options.host;
		this.port = options.port;

		void this.loadCache();
	}

	private async send (command: unknown[], skipError: boolean = false) {
		const response = await core.Got.get("GenericAPI")({
			url: `${this.host}:${this.port}`,
			searchParams: {
				mpv: JSON.stringify(command)
			}
		});

		const data = dataSchemas.generic.parse(response.body);
		if (!skipError && data.error !== "success") {
			if (typeof data.request_id === "number") {
				// MPV is listening, but the command failed
				throw new SupiError({
					message: `mpv command failure: ${data.error}`,
					args: { error: data.error, id: data.request_id }
				});
			}
			else if (data.error && TIMED_OUT_REGEX.test(data.error)) {
				// MPV is unreachable
				this.running = false;
			}
		}
		else {
			this.running = true;
		}

		return data;
	}

	private async loadCache (clearExisting: boolean = false) {
		const data = await core.Cache.getByPrefix(ITEM_DATA_CACHE_KEY) as MapEntries<typeof this.itemData> | undefined;
		if (!data) {
			return;
		}

		if (clearExisting) {
			this.itemData.clear();
		}

		for (const [key, value] of data) {
			this.itemData.set(key, value);
		}
	}

	private async saveCache () {
		const data = [...this.itemData.entries()] satisfies MapEntries<typeof this.itemData>;
		await core.Cache.setByPrefix(ITEM_DATA_CACHE_KEY, data, {
			expiry: 12 * 36e5 // 12 hours
		});
	}

	private async trimPlaylist () {
		if (!this.running) {
			return;
		}

		const playlist = await this.getPlaylist();
		const currentIndex = playlist.findIndex(i => i.current);
		if (currentIndex === -1) {
			return;
		}

		let skip = false;
		if (playlist.length === 1 && currentIndex === 0) {
			const { position, duration, paused } = await this.getUpdatedStatus();

			// When there is only one media in the playlist, and it's at the end, we need to change
			// the heuristic to try and figure out if it's ended. If the status is paused, and the
			// difference between `position` and `duration` is less than ~1 second, it's probably finished.
			if (paused && position !== null && duration !== null) {
				const probablyEnded = Math.abs(Math.trunc(duration) - Math.trunc(position)) <= 1;
				if (probablyEnded) {
					skip = true;
				}
			}
		}
		else if (currentIndex !== 0) {
			// If the currently playing media is not at the head of the playlist, remove the head of the playlist.
			skip = true;
		}

		if (skip) {
			await this.send(["playlist-remove", 0]);
			await this.saveCache();
			setTimeout(() => void this.play(), 2000);
		}
	}

	public async add (url: string, options: AddOptions = {}): Promise<Failure | AddSuccess> {
		const {
			name = null,
			user = null,
			duration = null,
			startTime,
			endTime
		} = options;

		if (startTime || endTime) {
			throw new SupiError({
				message: "Seeking with start/end times is currently not supported"
			});
		}

		for (const item of this.itemData.values()) {
			if (item.url === url) {
				return {
					success: false,
					reason: `URL is already queued with ID ${item.id}`
				};
			}
		}

		// const [playlist, status] = await Promise.all([this.getPlaylist(), this.getUpdatedStatus()]);
		// const type = (playlist.length === 0) ? "append-play" : "append-play";

		const status = await this.getUpdatedStatus();
		const type = "append-play";

		let timeUntil = (status.duration && status.position)
			? status.duration - status.position
			: 0;

		for (const item of this.itemData.values()) {
			timeUntil += item.duration ?? 0;
		}

		const raw = await this.send(["loadfile", url, type]);
		const id = dataSchemas.add.parse(raw.data).playlist_entry_id;

		this.itemData.set(id, {
			id,
			url,
			name,
			user,
			duration
		});

		await Promise.all([
			MpvClient.logMediaRequest({ pid: id, duration, user, url, name }),
			this.saveCache()
		]);

		return {
			success: true,
			id,
			timeUntil
		};
	}

	public async removeById (targetId: number, targetUser: number | null): Promise<Failure | RemoveSuccess> {
		const targetItem = this.itemData.get(targetId);
		if (!targetItem) {
			return {
				success: false,
				reason: "Target ID is not in playlist"
			};
		}

		if (targetUser !== null && targetItem.user !== targetUser) {
			return {
				success: false,
				reason: "Video was not requested by user"
			};
		}

		const playlist = await this.getPlaylist();
		const targetOrder = playlist.findIndex(i => i.id === targetItem.id);
		if (targetOrder === -1) {
			throw new SupiError({
				message: "Assert error: No media order found"
			});
		}

		await this.send(["playlist-remove", targetOrder]);
		await this.saveCache();

		return {
			success: true,
			url: targetItem.url,
			user: targetItem.user,
			name: targetItem.name,
			order: targetOrder,
			id: targetId
		};
	}

	public async removeUserFirst (targetUser: number): Promise<Failure | RemoveSuccess> {
		let targetId;
		for (const { user, id } of this.itemData.values()) {
			if (user !== targetUser) {
				continue;
			}

			targetId = id;
			break;
		}

		if (typeof targetId !== "number") {
			return {
				success: false,
				reason: "No media queued by user"
			};
		}

		return await this.removeById(targetId, targetUser);
	}

	public async playNext (): Promise<Success> {
		await this.send(["playlist-next", "force"]);
		await this.saveCache();

		return { success: true };
	}

	public async stop (): Promise<Success> {
		await this.send(["stop", "keep-playlist"]);
		return { success: true };
	}

	public async pause (): Promise<Success> {
		await this.send(["set_property", "pause", true]);
		return { success: true };
	}

	public async play (): Promise<Success> {
		await this.send(["set_property", "pause", false]);
		return { success: true };
	}

	public getCurrentStatus (): MpvStatus {
		if (!this.lastStatus) {
			throw new SupiError({
				message: "Assert error: Attempt to fetch mpv status before initialization"
			});
		}

		return this.lastStatus;
	}

	public async getPosition (): Promise<number | null> {
		const rawPosition = await this.send(["get_property", "time-pos"], true);
		const position = (rawPosition.error === PROPERTY_NA) ? null : dataSchemas.position.parse(rawPosition.data);

		return position;
	}

	public async getPlaylist (): Promise<MpvPlaylistItem[]> {
		const raw = await this.send(["get_property", "playlist"], true);
		if (raw.error !== "success") {
			this.running = false;
			return [];
		}

		const { data } = dataSchemas.playlist.parse(raw);
		const urls = new Set(data.map(i => i.filename));

		for (const [id, item] of this.itemData.entries()) {
			if (urls.has(item.url)) {
				continue;
			}

			this.itemData.delete(id);
		}

		return data.map((i, index) => {
			const extraData = this.itemData.get(i.id);
			return {
				id: i.id,
				index,
				url: i.filename,
				playing: i.playing ?? false,
				current: i.current ?? false,
				name: extraData?.name ?? null,
				duration: extraData?.duration ?? null,
				user: extraData?.user ?? null
			};
		});
	}

	public async getUpdatedStatus (): Promise<MpvStatus> {
		const [position, rawDuration, rawPlaylistCount, rawPause, playlist] = await Promise.all([
			this.getPosition(),
			this.send(["get_property", "duration"], true),
			this.send(["get_property", "playlist-count"], true),
			this.send(["get_property", "pause"], true),
			this.getPlaylist()
		]);

		const duration = (rawDuration.error === PROPERTY_NA) ? null : dataSchemas.duration.parse(rawDuration.data);
		const paused = dataSchemas.pause.parse(rawPause.data);
		const playlistCount = dataSchemas.playlistCount.parse(rawPlaylistCount.data);

		let extraCurrent;
		const mpvCurrent = playlist.at(0) ?? null;
		if (mpvCurrent) {
			extraCurrent = this.itemData.get(mpvCurrent.id);
		}

		this.lastStatus = {
			current: (mpvCurrent && extraCurrent)
				? {
					url: mpvCurrent.url,
					name: extraCurrent.name,
					user: extraCurrent.user,
					id: extraCurrent.id,
					playing: mpvCurrent.playing
				}
				: null,
			paused,
			position,
			duration,
			playlistCount
		};

		return this.lastStatus;
	}

	public async ping (): Promise<boolean> {
		const result = await this.send(["get_property", "idle-active"], true);
		this.running = (result.error === "success");
		return this.running;
	}

	public destroy (): void {
		clearInterval(this.finishedSongPlaylistClearInterval);
	}

	public static async logMediaRequest (data: MediaRequest): Promise<void> {
		if (MpvClient.loggingTableExists === null) {
			const exists = await core.Query.isTablePresent("stream", "Media_Request");
			if (!exists) {
				// @todo maybe create the table here
			}

			MpvClient.loggingTableExists = exists;
		}

		if (!MpvClient.loggingTableExists) {
			return;
		}

		const row = await core.Query.getRow<DatabaseMediaRequestRow>("stream", "Media_Request");
		row.setValues({
			PID: data.pid,
			Requester: data.user,
			URL: data.url,
			Name: data.name,
			Duration: data.duration
		});

		await row.save({ skipLoad: true });
	}
}
