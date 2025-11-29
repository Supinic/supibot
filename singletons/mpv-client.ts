import * as z from "zod";
import { SupiDate, SupiError } from "supi-core";

export type DatabaseVideo = {
	Added: SupiDate;
	Duration: number | null;
	End_Time: number | null;
	ID: number;
	Length: number | null;
	Link: string;
	Name: string;
	Notes: string | null;
	Start_Time: number | null;
	Started: SupiDate;
	Status: "Current" | "Inactive" | "Queued";
	User_Alias: number;
	VLC_ID: number;
	Video_Type: number;
};

type ConstructorOptions = {
	host: string;
	port: number;
};
type MpvStatus = {
	current: z.infer<typeof dataSchemas.playlist>["data"][number] | null;
	playlistCount: number;
	position: number | null;
	duration: number | null;
};

const PROPERTY_NA = "property unavailable";
const dataSchemas = {
	generic: z.object({
		data: z.unknown(),
		request_id: z.int(),
		error: z.string()
	}),

	add: z.object({ playlist_entry_id: z.int() }),
	duration: z.int(),
	position: z.int(),
	playlistCount: z.int(),
	playlist: z.object({
		data: z.array(z.object({
			filename: z.string(),
			playing: z.boolean(),
			current: z.boolean(),
			id: z.int()
		}))
	})
};

export class MpvClient {
	private readonly host: string;
	private readonly port: number;

	private counter = 0;
	private readonly urlMap = new Map<string, {
		id: number;
		url: string;
		user: number | null;
		description: string | null;
	}>();

	private lastStatus: MpvStatus | null = null;

	public constructor (options: ConstructorOptions) {
		this.host = options.host;
		this.port = options.port;
	}

	private async send (command: unknown[], skipError: boolean = false) {
		const url = new URL(`${this.host}:${this.port}/`);
		url.searchParams.set("mpv", JSON.stringify(command));

		const response = await fetch(url);
		const raw: unknown = await response.json();
		const data = dataSchemas.generic.parse(raw);

		if (!skipError && data.error !== "success") {
			throw new SupiError({
			    message: `mpv command failure: ${data.error}`,
				args: { error: data.error, id: data.request_id }
			});
		}

		return data;
	}

	public async getNormalizedPlaylist () {
		return await core.Query.getRecordset<DatabaseVideo[]>(rs => rs
			.select("*")
			.select(`
				(CASE 
					WHEN (Start_Time IS NOT NULL AND End_Time IS NOT NULL) THEN (End_Time - Start_Time)
					WHEN (Start_Time IS NOT NULL AND End_Time IS NULL) THEN (Length - Start_Time)
					WHEN (Start_Time IS NULL AND End_Time IS NOT NULL) THEN (End_Time)
					ELSE Length
					END
				) AS Duration
			`)
			.from("chat_data", "Song_Request")
			.where("Status <> %s", "Inactive")
		);
	}

	public async add (url: string, user: number | null, options: { description?: string | null; startTime?: number, endTime?: number } = {}) {
		// @todo seeking
		if (options.startTime || options.endTime) {
			throw new SupiError({
			    message: "Seeking with start/end times is currently not supported"
			});
		}

		const existing = this.urlMap.get(url);
		if (typeof existing !== "undefined") {
			throw new SupiError({
			    message: `URL is already queued with ID ${existing.id}`
			});
		}

		const id = this.counter++;
		const { playlistCount } = await this.getUpdatedStatus();
		const type = (playlistCount === 0) ? "append-play" : "append";

		const raw = await this.send(["loadfile", url, type]);
		const order = dataSchemas.add.parse(raw.data).playlist_entry_id;
		const description = options.description ?? null;

		this.urlMap.set(url, { id, url, user, description });

		return { success: true, order };
	}

	public async removeById (targetId: number, targetUser: number | null) {
		let targetItem;
		for (const item of this.urlMap.values()) {
			const { id, user } = item;
			if (id !== targetId) {
				continue;
			}

			if (targetUser !== null && user !== targetUser) {
				return {
					success: false,
					reason: "Video was not requested by user"
				};
			}

			targetItem = item;
			break;
		}

		if (!targetItem) {
			throw new SupiError({
			    message: "No valid url found with this index"
			});
		}

		let targetOrder;
		const playlist = await this.getPlaylist();
		for (const item of playlist) {
			if (item.filename === targetItem.url) {
				targetOrder = item.id;
				break;
			}
		}

		if (typeof targetOrder !== "number") {
			throw new SupiError({
			    message: "Assert error: No media order found"
			});
		}

		await this.send(["playlist-remove", targetOrder]);

		return {
			success: true,
			url: targetItem.url,
			user: targetItem.user,
			description: targetItem.description,
			order: targetOrder,
			id: targetId
		};
	}

	public async removeUserFirst (targetUser: number) {
		let targetId;
		for (const { user, id } of this.urlMap.values()) {
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

	public async playNext () {
		await this.send(["playlist-next", "force"]);
		return { success: true };
	}

	public async stop () {
		await this.send(["stop", "keep-playlist"]);
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

	public async getPlaylist () {
		const raw = await this.send(["get_property", "playlist"], true);
		if (raw.error !== "success") {
			return [];
		}

		const { data } = dataSchemas.playlist.parse(raw);
		const urls = new Set(data.map(i => i.filename));

		for (const url of this.urlMap.keys()) {
			if (urls.has(url)) {
				continue;
			}

			this.urlMap.delete(url);
		}

		return data;
	}

	public async getUpdatedStatus (): Promise<MpvStatus> {
		const [rawPosition, rawDuration, rawPlaylistCount, playlist] = await Promise.all([
			this.send(["get_property", "time-pos"], true),
			this.send(["get_property", "duration"], true),
			this.send(["get_property", "playlist-count"], true),
			this.getPlaylist()
		]);

		const position = (rawPosition.error === PROPERTY_NA) ? null : dataSchemas.position.parse(rawPosition.data);
		const duration = (rawPosition.error === PROPERTY_NA) ? null : dataSchemas.duration.parse(rawDuration.data);
		const playlistCount = dataSchemas.playlistCount.parse(rawPlaylistCount.data);

		let extraCurrent;
		const mpvCurrent = playlist.at(0) ?? null;
		if (mpvCurrent) {
			extraCurrent = this.urlMap.get(mpvCurrent.filename);
		}

		this.lastStatus = {
			current: (mpvCurrent)
				? { ...mpvCurrent, ...extraCurrent }
				: null,
			position,
			duration,
			playlistCount
		};

		return this.lastStatus;
	}
}
