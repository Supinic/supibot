/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
/**
 * VLC client based on the `node-vlc-http` client as created by @ldubos.
 * Rewritten to Javascript, with various changes.
 * Original: {@link https://github.com/ldubos/node-vlc-http}
 */

import http from "node:http";
import querystring from "node:querystring";
import EventEmitter from "node:events";
import { SupiDate, SupiError } from "supi-core";

import type { VlcPlaylistNode, VlcPlaylistRoot, VlcStatus, VlcTopPlaylist } from "./vlc-types.js";
import cacheKeys from "../utils/shared-cache-keys.json" with { type: "json" };

const { SONG_REQUESTS_VLC_PAUSED } = cacheKeys;

const get = (options: http.RequestOptions) => new Promise((resolve, reject) => {
	http.get(options, response => {
		const contentType = response.headers["content-type"] || "text/plain";
		if (response.statusCode !== 200) {
			reject(new Error(`Request failed. Status code ${response.statusCode}`));
		}
		else if (!/^application\/json/.test(contentType) && !/^text\/plain/.test(contentType)) {
			reject(new Error(`Invalid content type. Expected application/json or text/plain, received ${contentType}`));
		}

		let data = "";
		response.on("error", reject);
		response.on("data", (chunk: string) => (data += chunk));
		response.on("end", () => {
			try {
				resolve(JSON.parse(data));
			}
			catch (e) {
				reject(e as Error);
			}
		});
	}).on("error", (e) => reject(e));
});

const equal = (one: unknown, two: unknown) => (JSON.stringify(one) === JSON.stringify(two));

const CommandScope = {
	BROWSE: "/requests/browse.json",
	STATUS: "/requests/status.json",
	PLAYLIST: "/requests/playlist.json"
} as const;
type Scope = (typeof CommandScope)[keyof typeof CommandScope];

type ConstructorOptions = {
	host: string;
	port?: number;
	autoUpdate?: boolean;
	changeEvents?: boolean;
	tickLengthMs?: number;
	username?: string;
	password?: string;
	running?: boolean;
};
type Video = {
	Added: SupiDate;
	Duration: number;
	End_Time: number | null;
	ID: number;
	Length: number;
	Link: string;
	Name: string;
	Notes: string | null;
	Start_Time: number | null;
	Started: SupiDate;
	Status: "Current" | "Inactive" | "Pending";
	User_Alias: number;
	VLC_ID: number;
	Video_Type: number;
};

interface VlcClient {
	on (event: "tick", callback: () => void): this;
	on (event: "statuschange", callback: (previous: VlcStatus, current: VlcStatus) => void): this;
	on (event: "playlistchange", callback: (previous: VlcTopPlaylist, current: VlcTopPlaylist) => void): this;
	on (event: "update", callback: (status: VlcStatus, playlist: VlcPlaylistRoot) => void): this;
	on (event: "error", callback: (error: Error) => void): this;
}

class VlcClient extends EventEmitter {
	private readonly host: string;
	private readonly port: number;
	private readonly authorization: string;
	private readonly autoUpdate: boolean;
	private readonly changeEvents: boolean;

	private readonly tickLengthMs: number;
	private readonly longWaitMs: number;

	private running: boolean;
	private status: VlcStatus | null = null;
	private playlist: VlcTopPlaylist | null = null;

	public constructor (options: ConstructorOptions) {
		super();

		this.host = options.host;
		this.port = options.port ?? 8080;

		this.autoUpdate = options.autoUpdate ?? true;
		this.changeEvents = options.changeEvents ?? true;
		this.running = options.running ?? true;

		// node leaks memory if setTimeout is called with a value less than 16
		this.tickLengthMs = options.tickLengthMs ?? (1000 / 30);
		if (this.tickLengthMs < 16) {
			this.tickLengthMs = 16;
		}

		this.longWaitMs = Math.floor(this.tickLengthMs - 1);

		// generate authorization string as base64 string
		const { username = "", password = "" } = options;
		const authString = Buffer.from(`${username}:${password}`).toString("base64");
		this.authorization = `Basic ${authString}`;

		// start event-tick loop
		if (this.autoUpdate) {
			void this.doTick();
		}
	}

	public startRunning () { this.running = true; }
	public stopRunning () { this.running = false; }
	public isRunning () { return this.running; }

	public getPlaylist () { return this.playlist; }
	public getStatus () {
		if (!this.status) {
			throw new SupiError({
			    message: "Assert error: VLC queried for status before it could be established"
			});
		}

		return this.status;
	}

	public async addToQueue (uri: string) {
		return await this.sendCommand(CommandScope.STATUS, "in_enqueue", { input: uri });
	}

	public async addToQueueAndPlay (uri: string, option?: "noaudio" | "novideo") {
		const options = {
			input: uri,
			option
		};

		return await this.sendCommand(CommandScope.STATUS, "in_play", options);
	}

	public async playlistNext () {
		return await this.sendCommand(CommandScope.STATUS, "pl_next");
	}

	public async playlistPrevious () {
		return await this.sendCommand(CommandScope.STATUS, "pl_previous");
	}

	public async playlistDelete (id: number) {
		return await this.sendCommand(CommandScope.STATUS, "pl_delete", { id });
	}

	public async playlistEmpty () {
		return await this.sendCommand(CommandScope.STATUS, "pl_empty");
	}

	public async setVolume (volume: number | string) {
		return await this.sendCommand(CommandScope.STATUS, "volume", { val: volume });
	}

	public async seek (time: string | number) {
		return await this.sendCommand(CommandScope.STATUS, "seek", { val: time });
	}

	public async stop () {
		return await this.sendCommand(CommandScope.STATUS, "pl_stop");
	}

	public async updateStatus () {
		const status = await this.sendCommand(CommandScope.STATUS) as VlcStatus;

		if (this.changeEvents && !equal(status, this.status)) {
			try {
				this.emit("statuschange", this.status ?? status, status);
			}
			catch (e) {
				this.emit("error", e);
			}

			this.status = status;
		}

		return status;
	}

	public async updatePlaylist () {
		const playlist = await this.sendCommand(CommandScope.PLAYLIST) as VlcTopPlaylist;

		if (this.changeEvents && !equal(playlist, this.playlist)) {
			try {
				this.emit("playlistchange", this.playlist ?? playlist, playlist);
			}
			catch (e) {
				this.emit("error", e);
			}

			this.playlist = playlist;
		}

		return playlist;
	}

	private async sendCommand (scope: Scope, command?: string | null, options: Record<string, string | number | undefined> = {}) {
		let query = null;
		if (command) {
			query = querystring.stringify({ command, ...options });
		}
		else {
			query = querystring.stringify(options);
		}

		return get({
			host: this.host,
			port: this.port,
			path: `${scope}${query ? `?${query}` : ""}`,
			headers: {
				Authorization: this.authorization
			}
		});
	}

	private async doTick () {
		this.emit("tick", this.running);

		const isRunningNow = this.running;
		if (isRunningNow) {
			try {
				await this.updateAll();
				if (!this.running) {
					this.startRunning();
				}
			}
			catch (e) {
				console.error(e);
				if (this.running) {
					this.stopRunning();
				}
			}
		}

		setTimeout(
			() => void this.doTick(),
			Math.max(this.longWaitMs, this.tickLengthMs)
		);
	}

	private async updateAll () {
		const [status, playlist] = await Promise.all([
			this.updateStatus(),
			this.updatePlaylist()
		]);

		try {
			this.emit("update", status, playlist);
		}
		catch (e) {
			this.emit("error", e);
		}

		return [status, playlist];
	}
}

const matchParent = (list: VlcPlaylistNode[], targetID: number) => {
	for (const track of list) {
		const ID = Number(track.id);
		if (targetID === ID) {
			return track;
		}
		else if (track.children && matchParent(track.children, targetID)) {
			return track;
		}
	}

	return null;
};

export class VlcConnector {
	public readonly client: VlcClient;

	private readonly seekValues: { start: number | null; end: number | null; } = { start: null, end: null };

	public constructor (options: ConstructorOptions) {
		this.client = new VlcClient({
			host: options.host,
			port: options.port,
			username: options.username,
			password: options.password,
			autoUpdate: true,
			changeEvents: true,
			tickLengthMs: 250
		});

		this.initListeners();
	}

	/**
	 * Adds a video to the playlist queue.
	 */
	public async add (link: string, options: { startTime?: number; endTime?: number; } = {}) {
		const status = await this.client.updateStatus();
		if (status.currentplid === -1) {
			await this.client.addToQueueAndPlay(link);

			if (options.startTime) {
				this.seekValues.start = options.startTime;
			}
			if (options.endTime) {
				this.seekValues.end = options.endTime;
			}
		}
		else {
			await this.client.addToQueue(link);
		}

		const topPlaylistData = await this.client.updatePlaylist();
		const playlistData = topPlaylistData.children[0];

		const ids = playlistData.children.map(i => Number(i.id));
		return Math.max(...ids);
	}

	public async getNormalizedPlaylist () {
		return await core.Query.getRecordset<Video[]>(rs => rs
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

	public get currentPlaylist () {
		const playlist = this.client.getPlaylist();
		if (!playlist) {
			return [];
		}

		const mediaPlaylist = playlist.children[0];
		return mediaPlaylist.children;
	}

	public get currentPlaylistItem () {
		const list = [...this.currentPlaylist];
		for (const item of list) {
			if (item.current === "current") {
				return item;
			}

			if (item.children) {
				list.unshift(...item.children);
			}
		}

		return null;
	}

	private initListeners () {
		const client = this.client;

		client.on("update", (status) => void this.onUpdate(status));
		client.on("statuschange", (previous, current) => void this.onStatusChange(previous, current));
		client.on("playlistchange", (previous, current) => void this.onPlaylistChange(previous, current));

		client.on("error", (err) => {
			console.error(err);
			client.stopRunning();
		});
	}

	private async onUpdate (status: VlcStatus) {
		const item = this.currentPlaylistItem;
		if (item === null) {
			return;
		}

		if (this.seekValues.start !== null && Object.keys(status.information.category).length > 1) {
			// Since the VLC API does not support seeking to milliseconds parts when using ISO8601 or seconds,
			// a percentage needs to be calculated, since that (for whatever reason) works using decimals.
			const percentage = core.Utils.round(this.seekValues.start / status.length, 5) * 100;
			await this.client.seek(`${percentage}%`);

			this.seekValues.start = null;
		}
		else if (this.seekValues.end !== null && status.time >= this.seekValues.end) {
			const queueLength = this.currentPlaylist.length;
			if (queueLength < 2) {
				await this.client.stop();
			}
			else {
				await this.client.playlistNext();
			}

			this.seekValues.end = null;
		}
	}

	private async onStatusChange (before: VlcStatus, after: VlcStatus) {
		const currentPauseStatus = await core.Cache.getByPrefix(SONG_REQUESTS_VLC_PAUSED);
		if (currentPauseStatus && after.state === "playing") {
			await core.Cache.setByPrefix(SONG_REQUESTS_VLC_PAUSED, false);
		}
		else if (!currentPauseStatus && after.state === "paused") {
			await core.Cache.setByPrefix(SONG_REQUESTS_VLC_PAUSED, true);
		}

		const previous = before.currentplid;
		const next = after.currentplid;

		if (previous !== next) {
			const playlist = this.currentPlaylist;
			await this.onVideoChange(previous, next, playlist);
		}
	}

	private async onVideoChange (previousId: number, nextId: number, playlist: VlcPlaylistNode[]) {
		const previousTrack = matchParent(playlist, previousId);
		const nextTrack = matchParent(playlist, nextId);
		if (previousTrack === nextTrack) {
			return;
		}

		if (previousTrack) {
			// Finalize the previous video, if it exists (might not exist because of playlist being started)
			const ID = Number(previousTrack.id);
			await core.Query.getRecordUpdater(rs => rs
				.update("chat_data", "Song_Request")
				.set("Status", "Inactive")
				.set("Ended", new SupiDate())
				.where("Status = %s", "Current")
				.where("VLC_ID = %n", ID)
			);

			await this.client.playlistDelete(ID);
		}
		if (nextTrack) {
			const ID = await core.Query.getRecordset<Video["ID"] | undefined>(rs => rs
				.select("ID")
				.from("chat_data", "Song_Request")
				.where("VLC_ID = %n", Number(nextTrack.id))
				.where("Status = %s", "Queued")
				.single()
				.flat("ID")
			);

			// This happens when no video is in queue, and the addition happens earlier than the song request
			// object being inserted in the database (from the song request command)
			if (!ID) {
				return;
			}

			const row = await core.Query.getRow<Video>("chat_data", "Song_Request");
			await row.load(ID);

			row.setValues({
				Status: "Current",
				Started: new SupiDate()
			});

			this.seekValues.start = row.values.Start_Time ?? null;
			this.seekValues.end = row.values.End_Time ?? null;

			// Assign the status and started timestamp to the video, because it just started playing.
			await row.save();
		}
	}

	private async onPlaylistChange (previous: VlcTopPlaylist, current: VlcTopPlaylist) {
		// @todo convert to Set intersection methods when available
		const previousIDs = previous.children[0].children.map(i => Number(i.id));
		const nextIDs = new Set(current.children[0].children.map(i => Number(i.id)));

		const missingIDs = previousIDs.filter(id => !nextIDs.has(id));
		if (missingIDs.length > 0) {
			const noUpdateIDs: number[] = [];
			for (const item of previous.children[0].children) {
				if (item.duration !== -1 || !item.uri?.includes("youtu")) {
					continue;
				}

				// Pseudo-heuristic to prevent inadvertent playlist request deletion caused by
				// VLC creating a new request after loading a YouTube video.
				// E.g. YouTube video is added as ID 30, and when it plays, VLC fetches the actual video data,
				// creating a new request with ID 31, causing the ID 30 (the real video) to be deleted.
				await core.Query.getRecordUpdater(ru => ru
					.update("chat_data", "Song_Request")
					.set("VLC_ID", Number(item.id) + 1)
					.where("VLC_ID = %n", Number(item.id))
					.where("Status IN %s+", ["Queued", "Current"])
				);

				noUpdateIDs.push(Number(item.id));
			}

			const filteredMissingIDs = missingIDs.filter(i => !noUpdateIDs.includes(i));
			await core.Query.getRecordUpdater(rs => rs
				.update("chat_data", "Song_Request")
				.set("Status", "Inactive")
				.where("VLC_ID IN %n+", filteredMissingIDs)
				.where("Status IN %s+", ["Queued", "Current"])
			);
		}
	}
};
