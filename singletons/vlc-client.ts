/**
 * VLC client based on the `node-vlc-http` client as created by @ldubos.
 * Rewritten to Javascript, with various changes.
 * Original: {@link https://github.com/ldubos/node-vlc-http}
 */

import http from "node:http";
import querystring from "node:querystring";
import EventEmitter from "node:events";
import { SupiDate } from "supi-core";
import getLinkParser from "../utils/link-parser.js";

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

type Information = {
	chapter: number;
	chapters: number[];
	title: number;
	category: Category;
	titles: number[];
};
type Category = {
	meta: Meta;
	[flux: string]: { [key: string]: string } | Meta;
};
type Audiofilters = {
	[filter: string]: string;
};
type Meta = {
	encoded_by: string;
	filename: string;
};
type VideoEffects = {
	hue: number;
	saturation: number;
	contrast: number;
	brightness: number;
	gamma: number;
};

type Stats = { [key: string]: number };
type State = "paused" | "playing" | "stopped";
type AspectRatio = "1:1" | "4:3" | "5:4" | "16:9" | "16:10" | "221:100" | "235:100" | "239:100";

type StatusBase = {
	fullscreen: boolean;
	stats: Stats | null;
	aspectratio: AspectRatio | null;
	audiodelay: number;
	apiversion: number;
	currentplid: number;
	time: number;
	volume: number;
	length: number;
	random: boolean;
	audiofilters: Audiofilters;
	rate: number;
	videoeffects: VideoEffects;
	state: State;
	loop: boolean;
	version: string;
	position: number;
	information: Information;
	repeat: boolean;
	subtitledelay: number;
	equalizer: unknown[];
};
type StatusPaused = StatusBase & {
	stats: Stats;
	aspectratio: AspectRatio;
	state: "paused";
};
type StatusPlaying = StatusBase & {
	stats: Stats;
	aspectratio: AspectRatio;
	state: "playing";
};
type StatusStopped = StatusBase & {
	stats: null;
	aspectratio: null;
	state: "stopped";
};
type Status = StatusPaused | StatusPlaying | StatusStopped;

type Node = {
	id: string;
	name: string;
	ro: "rw" | "ro";
	current?: string;
	duration?: number;
	type?: "node" | "leaf";
	uri?: string;
};
type Root = Node & {
	children: Node[];
	name: "Playlist";
	type: "node";
	ro: "ro";
}
type TopPlaylist = Root & {
	children: [
		Root & { name: "Playlist"; },
		Root & { name: "Media library"; }
	];
};

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
	Status: "Current" | "Inactive" | "Pending";
	User_Alias: number;
	VLC_ID: number;
	Video_Type: number;
};

interface VlcEvents {
	on (event: "tick", callback: () => void): this;
	on (event: "statuschange", callback: (status: Status) => void): this;
	on (event: "playlistchange", callback: (playlist: Root) => void): this;
	on (event: "update", callback: (status: Status, playlist: Root) => void): this;
	on (event: "error", callback: (error: Error) => void): this;
}

class VlcClient extends EventEmitter implements VlcEvents {
	private readonly host: string;
	private readonly port: number;
	private readonly authorization: string;
	private readonly autoUpdate: boolean;
	private readonly changeEvents: boolean;

	private readonly tickLengthMs: number;
	private readonly longWaitMs: number;

	private running: boolean;
	private status: Status | null = null;
	private playlist: Root | null = null;

	constructor (options: ConstructorOptions) {
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

	public async updateStatus () {
		const status = await this.sendCommand(CommandScope.STATUS) as Status;

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
		const playlist = await this.sendCommand(CommandScope.PLAYLIST) as TopPlaylist;

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

export class VlcConnector {
	readonly client: VlcClient;

	private readonly baseURL: string;
	private readonly videoQueue: unknown[];
	private readonly requestsID: unknown;
	private readonly seekValues: {
		start: number | null;
		end: number | null;
	};

	constructor (options: ConstructorOptions) {
		this.client = new VLCClient({
			host: options.url,
			port: options.port,
			username: options.username,
			password: options.password,
			autoUpdate: true,
			changeEvents: true,
			tickLengthMs: 250
		});

		this.baseURL = options.baseURL;
		this.videoQueue = [];
		this.requestsID = {};
		this.seekValues = {
			start: null,
			end: null
		};

		this.initListeners();
	}

	initListeners () {
		const client = this.client;

		client.on("update", async (status) => {
			const item = this.currentPlaylistItem;
			if (item !== null) {
				if (this.seekValues.start !== null && Object.keys(status.information.category).length > 1) {
					// Since the VLC API does not support seeking to milliseconds parts when using ISO8601 or seconds,
					// a percentage needs to be calculated, since that (for whatever reason) works using decimals.
					const percentage = core.Utils.round(this.seekValues.start / status.length, 5) * 100;
					await client.seek(`${percentage}%`);

					this.seekValues.start = null;
				}

				else if (this.seekValues.end !== null && status.time >= this.seekValues.end) {
					const queue = this.currentPlaylist.length;
					if (queue < 2) {
						await client.stop();
					}
					else {
						await client.playlistNext();
					}

					this.seekValues.end = null;
				}
			}
		});

		client.on("statuschange", async (before, after) => {
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
				const { children } = await this.playlist();
				client.emit("videochange", previous, next, children);
			}
		});

		client.on("videochange", async (previousID, nextID, playlist) => {
			const previousTrack = this.matchParent(playlist, previousID);
			const nextTrack = this.matchParent(playlist, nextID);
			if (previousTrack === nextTrack) {
				return;
			}

			if (previousTrack) {
				// Finalize the previous video, if it exists (might not exist because of playlist being started)
				const ID = Number(previousTrack.id);
				await core.Query.getRecordUpdater(rs => rs
					.update("chat_data", "Song_Request")
					.set("Status", "Inactive")
					.set("Ended", new sb.Date())
					.where("Status = %s", "Current")
					.where("VLC_ID = %n", ID)
				);

				await client.playlistDelete(ID);
			}
			if (nextTrack) {
				const ID = await core.Query.getRecordset(rs => rs
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

				const row = await core.Query.getRow("chat_data", "Song_Request");
				await row.load(ID);

				row.setValues({
					Status: "Current",
					Started: new sb.Date()
				});

				this.seekValues.start = row.values.Start_Time ?? null;
				this.seekValues.end = row.values.End_Time ?? null;

				// Assign the status and started timestamp to the video, because it just started playing.
				await row.save();
			}
		});

		client.on("playlistchange", async (prev, next) => {
			// @todo convert to Set intersection methods when available
			const previousIDs = prev.children[0].children.map(i => Number(i.id));
			const nextIDs = new Set(next.children[0].children.map(i => Number(i.id)));

			const missingIDs = previousIDs.filter(id => !nextIDs.has(id));
			if (missingIDs.length > 0) {
				const noUpdateIDs = [];
				for (const item of prev.children[0].children) {
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
					noUpdateIDs.push(item.id);
				}

				const filteredMissingIDs = missingIDs.filter(i => !noUpdateIDs.includes(i));
				await core.Query.getRecordUpdater(rs => rs
					.update("chat_data", "Song_Request")
					.set("Status", "Inactive")
					.where("VLC_ID IN %n+", filteredMissingIDs)
					.where("Status IN %s+", ["Queued", "Current"])
				);
			}
		});

		client.on("error", (err) => {
			console.error(err);
			client.stopRunning();
		});
	}

	/**
	 * Adds a video to the playlist queue.
	 * @param {string} link
	 * @param {Object} options={}
	 * @param {number} [options.startTime] Automatic seek to a given position after start, if queued to a empty playlist
	 * @param {number} [options.endTime] Automatic seek to a given position while run ning, if queued to a empty playlist
	 * @returns {Promise<number>}
	 */
	async add (link: string, options: { startTime?: number; endTime?: number; } = {}) {
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
			await this.getStatus("in_enqueue", { input: link });
		}

		const topPlaylistData = await this.client.updatePlaylist();
		const playlistData = topPlaylistData.children[0];

		const ids = playlistData.children.map(i => Number(i.id));
		return Math.max(...ids);
	}

	async currentlyPlaying () {
		const status = await this.status();
		if (!status.information) {
			return null;
		}
		else {
			return status.information;
		}
	}

	async currentlyPlayingData () {
		let status;
		try {
			status = await this.status();
		}
		catch (e) {
			if (e.message === "ETIMEDOUT") {
				return null;
			}
			else {
				throw e;
			}
		}

		if (status.currentplid === -1 || status.length === -1) {
			return null;
		}

		const linkParser = await getLinkParser();
		const targetURL = linkParser.parseLink(status.information.category.meta.url);
		return this.videoQueue.find(songData => {
			try {
				const songURL = linkParser.parseLink(songData.link);
				return songURL === targetURL;
			}
			catch {
				return songData.link === targetURL;
			}
		});
	}


	matchParent (list, targetID) {
		for (const track of list) {
			const ID = Number(track.id);
			if (targetID === ID) {
				return track;
			}
			else if (track.children && this.matchParent(track.children, targetID)) {
				return track;
			}
		}

		return null;
	}

	async getDataByName (name, link) {
		const playlist = await this.playlist();
		return playlist.children.find(i => i.name === name || i.name === link);
	}

	get currentPlaylist () {
		return this.client.playlist?.children?.[0]?.children ?? [];
	}

	get currentPlaylistItem () {
		const list = [...this.currentPlaylist];
		while (list.length > 0) {
			const item = list.shift();
			if (item.current === "current") {
				return item;
			}

			if (Array.isArray(item.children)) {
				list.unshift(...item.children);
			}
		}

		return null;
	}

	get modulePath () { return "vlc-connector"; }

	destroy () {
		this.client.removeAllListeners();
		this.client = null;
	}
};

