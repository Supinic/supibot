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

const PROPERTY_NA = "property unavailable";
const dataSchemas = {
	generic: z.object({
		data: z.unknown(),
		request_id: z.int(),
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

export async function logRequest () {
	// @todo finish or integrate
}

// @todo integrate a self-caching system that stores current item data map to Redis on all updates
// and restores it on load (if available and relevant)

export class MpvClient {
	private readonly host: string;
	private readonly port: number;
	private readonly itemData = new Map<number, MpvItem>();
	private lastStatus: MpvStatus | null = null;

	private static loggingTableExists: boolean | null = null;

	public constructor (options: ConstructorOptions) {
		this.host = options.host;
		this.port = options.port;
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

		const [playlist, status] = await Promise.all([this.getPlaylist(), this.getUpdatedStatus()]);
		const type = (playlist.length === 0) ? "append-play" : "append";

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

		await MpvClient.logMediaRequest({
			pid: id,
			duration,
			user,
			url,
			name
		});

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
		return { success: true };
	}

	public async stop (): Promise<Success> {
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

	public async getPosition () {
		const rawPosition = await this.send(["get_property", "time-pos"], true);
		const position = (rawPosition.error === PROPERTY_NA) ? null : dataSchemas.position.parse(rawPosition.data);

		return position;
	}

	public async getPlaylist (): Promise<MpvPlaylistItem[]> {
		const raw = await this.send(["get_property", "playlist"], true);
		if (raw.error !== "success") {
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
