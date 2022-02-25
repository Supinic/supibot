/**
 * VLC client based on the `node-vlc-http` client as created by @ldubos.
 * Rewritten to Javascript, with various changes.
 * Original: {@link https://github.com/ldubos/node-vlc-http}
 */

const http = require("http");
const querystring = require("querystring");

const get = (options) => new Promise((resolve, reject) => {
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
		response.on("data", chunk => (data += chunk));
		response.on("end", () => {
			try {
				resolve(JSON.parse(data));
			}
			catch (e) {
				reject(e);
			}
		});
	}).on("error", (e) => reject(e));
});

const equal = (one, two) => (JSON.stringify(one) === JSON.stringify(two));

const CommandScope = {
	BROWSE: "/requests/browse.json",
	STATUS: "/requests/status.json",
	PLAYLIST: "/requests/playlist.json"
};

module.exports = class VLCClient extends require("events") {
	#host;
	#port;
	#autoUpdate = true;
	#changeEvents = true;
	#authorization;
	#tickLengthMs;
	#longWaitMs;
	#status = null; // type {Status}, see below
	#playlist = null;
	#running = true;

	/**
	 * @param {Object} options
	 * @param {string} [options.host]
	 * @param {number} [options.port]
	 * @param {string} options.username
	 * @param {string} options.password
	 * @param {boolean} [options.autoUpdate] = true turn on automatic updating by default
	 * @param {number} [options.tickLengthMs] timeout in milliseconds for the update loop interval
	 * @param {boolean} [options.changeEvents] checks that browse, status and playlist have changed since the last update of one of its elements,
	 if it the case fire browsechange, statuschange or playlistchange event. default true.
	 * @param {boolean} [options.running]
	 */
	constructor (options) {
		super();

		this.#host = options.host ?? "127.0.0.1";
		this.#port = options.port ?? 8080;

		if (typeof options.autoUpdate === "boolean") {
			this.#autoUpdate = options.autoUpdate;
		}

		if (typeof options.changeEvents === "boolean") {
			this.#changeEvents = options.changeEvents;
		}

		this.#tickLengthMs = options.tickLengthMs ?? 1000 / 30;

		// node leaks memory if setTimeout is called with a value less than 16
		if (this.#tickLengthMs < 16) {
			this.#tickLengthMs = 16;
		}

		this.#longWaitMs = Math.floor(this.#tickLengthMs - 1);

		// generate authorization string
		const authString = Buffer.from(`${options.username}:${options.password}`).toString("base64");
		this.#authorization = `Basic ${authString}`;

		if (typeof options.running === "boolean") {
			this.#running = options.running;
		}

		if (this.#autoUpdate) {
			// start loop
			this.#doTick();
		}
	}

	startRunning () {
		this.#running = true;
	}

	stopRunning () {
		this.#running = false;
	}

	async #doTick () {
		this.emit("tick", this.#running);

		if (this.#running) {
			try {
				await this.updateAll();
				if (!this.#running) {
					this.startRunning();
				}
			}
			catch (e) {
				console.error(e);
				if (this.#running) {
					this.stopRunning();
				}
			}
		}

		setTimeout(
			() => this.#doTick(),
			Math.max(this.#longWaitMs, this.#tickLengthMs)
		);
	}

	async #sendCommand (scope, command, options) {
		let query = null;

		if (command) {
			query = querystring.stringify({ command, ...options });
		}
		else if (!command && query) {
			query = querystring.stringify(options);
		}

		return get({
			host: this.#host,
			port: this.#port,
			path: `${scope}${query ? `?${query}` : ""}`,
			headers: {
				Authorization: this.#authorization
			}
		});
	}

	async browse (path) {
		return await this.#sendCommand(CommandScope.BROWSE, null, {
			dir: path
		});
	}

	async updateStatus () {
		const status = await this.#sendCommand(CommandScope.STATUS);

		if (this.#changeEvents && !equal(status, this.#status)) {
			try {
				this.emit("statuschange", this.#status || status, status);
			}
			catch (e) {
				this.emit("error", e);
			}

			this.#status = status;
		}

		return status;
	}

	async updatePlaylist () {
		const playlist = await this.#sendCommand(CommandScope.PLAYLIST);

		if (this.#changeEvents && !equal(playlist, this.#playlist)) {
			try {
				this.emit("playlistchange", this.#playlist || playlist, playlist);
			}
			catch (e) {
				this.emit("error", e);
			}


			this.#playlist = playlist;
		}

		return playlist;
	}

	async updateAll () {
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

	/**
	 * Add `uri` to playlist and start playback.
	 * @param {string} uri
	 * @param {"noaudio" | "novideo"} option
	 */
	async addToQueueAndPlay (uri, option) {
		const options = {
			input: uri,
			option
		};

		return await this.#sendCommand(CommandScope.STATUS, "in_play", options);
	}

	/**
	 * Add `uri` to playlist.
	 * @param {string} uri
	 */
	async addToQueue (uri) {
		return await this.#sendCommand(CommandScope.STATUS, "in_enqueue", { input: uri });
	}

	/**
	 * Add subtitle to currently playing file.
	 * @param {string} uri
	 */
	async addSubtitle (uri) {
		return await this.#sendCommand(CommandScope.STATUS, "addsubtitle", {
			input: uri
		});
	}

	/**
	 * Play playlist item `id`. If `id` is omitted, play last active item.
	 * @param {number} id
	 */
	async play (id) {
		return await this.#sendCommand(CommandScope.STATUS, "pl_play", { id });
	}

	/**
	 * Toggle pause. If current state was "stop", play item `id`, if `id` is omitted, play current item.
	 * If no current item, play 1st item in the playlist.
	 * @param {number} id
	 */
	async pause (id) {
		return await this.#sendCommand(CommandScope.STATUS, "pl_pause", { id });
	}

	/**
	 * Stop playback.
	 */
	async stop () {
		return await this.#sendCommand(CommandScope.STATUS, "pl_stop");
	}

	/**
	 * Resume playback if state was "paused", else do nothing.
	 */
	async resume () {
		return await this.#sendCommand(CommandScope.STATUS, "pl_forceresume");
	}

	/**
	 * Pause playback, do nothing if state was "paused".
	 */
	async forcePause () {
		return await this.#sendCommand(CommandScope.STATUS, "pl_forcepause");
	}

	/**
	 * Jump to next item in playlist.
	 */
	async playlistNext () {
		return await this.#sendCommand(CommandScope.STATUS, "pl_next");
	}

	/**
	 * Jump to previous item in playlist.
	 */
	async playlistPrevious () {
		return await this.#sendCommand(CommandScope.STATUS, "pl_previous");
	}

	/**
	 * Delete item `id` from playlist.
	 * @param {number} id
	 */
	async playlistDelete (id) {
		return await this.#sendCommand(CommandScope.STATUS, "pl_delete", { id });
	}

	/**
	 * Empty playlist.
	 */
	async playlistEmpty () {
		return await this.#sendCommand(CommandScope.STATUS, "pl_empty");
	}

	/**
	 * Sort playlist using sort mode `mode` and order `order`.
	 * If `order` = 0 then items will be sorted in normal order, if `order` = 1 ` they will be sorted in reverse order.
	 * A non exhaustive list of sort modes:
	 *  0 Id
	 *  1 Name
	 *  3 Author
	 *  5 Random
	 *  7 Track number
	 * @param {0|1} order
	 * @param {0|1|3|5|7} mode
	 */
	async sortPlaylist (order, mode) {
		return await this.#sendCommand(CommandScope.STATUS, "pl_sort", {
			id: mode,
			val: order
		});
	}

	/**
	 * Set audio delay.
	 * @param {number} delay
	 */
	async setAudioDelay (delay) {
		return await this.#sendCommand(CommandScope.STATUS, "audiodelay", { val: delay });
	}

	/**
	 * Set subtitle delay.
	 * @param {number} delay
	 */
	async setSubtitleDelay (delay) {
		return await this.#sendCommand(CommandScope.STATUS, "subdelay", { val: delay });
	}

	/**
	 * Set playback rate.
	 * @param {number} rate
	 */
	async setPlaybackRate (rate) {
		return await this.#sendCommand(CommandScope.STATUS, "rate", { val: rate });
	}

	/**
	 * Set aspect ratio.
	 * @param {VLCAspectRatio} ratio
	 */
	async setAspectRatio (ratio) {
		return await this.#sendCommand(CommandScope.STATUS, "aspectratio", {
			val: ratio
		});
	}

	/**
	 * Set volume level to `volume`.
	 * @param {number|string} volume
	 */
	async setVolume (volume) {
		return await this.#sendCommand(CommandScope.STATUS, "volume", { val: volume });
	}

	/**
	 * Set the preamp value.
	 * @param {number} value
	 */
	async setPreamp (value) {
		return await this.#sendCommand(CommandScope.STATUS, "preamp", { val: value });
	}

	/**
	 * Set the gain for a specific band.
	 * @param {number} band
	 * @param {number} gain
	 */
	async setEqualizer (band, gain) {
		return await this.#sendCommand(CommandScope.STATUS, "equalizer", {
			band,
			val: gain
		});
	}

	/**
	 * Set the equalizer preset as per the `id` specified.
	 * @param {number} id
	 */
	async setEqualizerPreset (id) {
		return await this.#sendCommand(CommandScope.STATUS, "equalizer", { val: id });
	}

	/**
	 * Toggle random playback.
	 */
	async toggleRandom () {
		return await this.#sendCommand(CommandScope.STATUS, "pl_random");
	}

	/**
	 * Toggle loop.
	 */
	async toggleLoop () {
		return await this.#sendCommand(CommandScope.STATUS, "pl_loop");
	}

	/**
	 * Toggle repeat.
	 */
	async toggleRepeat () {
		return await this.#sendCommand(CommandScope.STATUS, "pl_repeat");
	}

	/**
	 * Toggle fullscreen.
	 */
	async toggleFullscreen () {
		return await this.#sendCommand(CommandScope.STATUS, "fullscreen");
	}

	/**
	 * Seek to `time`.
	 * @param {number} time
	 */
	async seek (time) {
		return await this.#sendCommand(CommandScope.STATUS, "seek", { val: time });
	}

	/**
	 * Seek to chapter `chapter`.
	 * @param {number} chapter
	 */
	async seekToChapter (chapter) {
		return await this.#sendCommand(CommandScope.STATUS, "chapter", { val: chapter });
	}
};

/**
 * @typedef {"1:1" | "4:3" | "5:4" | "16:9" | "16:10" | "221:100" | "235:100" | "239:100"} VLCAspectRatio
 */

// @todo create Jsdoc
/*
 export interface Information {
 chapter: number;
 chapters: number[];
 title: number;
 category: Category;
 titles: number[];
 }

 export interface Category {
 meta: Meta;
 [flux: string]: { [key: string]: string } | Meta;
 }

 export interface Flux {
 [flux: string]: string;
 }

 export interface Audiofilters {
 [filter: string]: string;
 }

 export interface Meta {
 encoded_by: string;
 filename: string;
 }

 export interface Videoeffects {
 hue: number;
 saturation: number;
 contrast: number;
 brightness: number;
 gamma: number;
 }

 type Stats = { [key: string]: number };

 type AspectRatio =
 | "1:1"
 | "4:3"
 | "5:4"
 | "16:9"
 | "16:10"
 | "221:100"
 | "235:100"
 | "239:100";

 type State = "paused" | "playing" | "stopped";

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
 videoeffects: Videoeffects;
 state: State;
 loop: boolean;
 version: string;
 position: number;
 information: Information;
 repeat: boolean;
 subtitledelay: number;
 equalizer: any[];
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
 */
