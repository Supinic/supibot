const actions = [
	"addToQueue",
	"addToQueueAndPlay",
	"addSubtitle",
	"play",
	"pause",
	{
		name: "stop",
		command: "pl_stop"
	},
	"resume",
	"forcePause",
	"playlistDelete",
	"playlistNext",
	"playlistPrevious",
	"playlistEmpty",
	"sortPlaylist",
	"toggleRandom",
	"toggleLoop",
	"toggleRepeat",
	"toggleFullscreen",
	"seek",
	"seekToChapter"
];

const mandatoryConfigs = [
	"LOCAL_VLC_IP",
	"LOCAL_VLC_BASE_URL"
];

/**
 * VideoLANConnector (VLC) handler module - handles a VLC instance's playlist and methods.
 */
module.exports = class VLCSingleton extends require("./template.js") {
	/**
	 * @inheritDoc
	 * @returns {VLCSingleton}
	 */
	static singleton () {
		if (!VLCSingleton.module) {
			const missingConfigs = mandatoryConfigs.filter(key => !sb.Config.has(key));
			if (missingConfigs.length !== 0) {
				console.debug("Missing VLC config(s), module creation skipped", { missingConfigs });
				VLCSingleton.module = {};
			}
			else {
				VLCSingleton.module = new VLCSingleton({
					baseURL: sb.Config.get("LOCAL_VLC_BASE_URL", true),
					url: sb.Config.get("LOCAL_VLC_IP", true),
					port: 8080,
					username: "",
					password: "supinic",
					running: (sb.Config.get("SONG_REQUESTS_STATE", false) === "vlc")
				});
			}
		}

		return VLCSingleton.module;
	}

	constructor (options = {}) {
		super();

		const VLCClient = require("./vlc-client.js");

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

		this._actions = {};
		for (const action of actions) {
			if (typeof action === "string") {
				this._actions[action] = (...args) => this.client[action](...args);
			}
			else if (action?.constructor === Object) {
				this._actions[action.name] = () => this.client._sendCommand("/requests/status.json", action.command);
			}
		}

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
					const percentage = sb.Utils.round(this.seekValues.start / status.length, 5) * 100;
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
			if (sb.Config.has("SONG_REQUESTS_VLC_PAUSED", false)) {
				const currentPauseStatus = sb.Config.get("SONG_REQUESTS_VLC_PAUSED");
				if (currentPauseStatus && after.state === "playing") {
					await sb.Config.set("SONG_REQUESTS_VLC_PAUSED", false);
				}
				else if (!currentPauseStatus && after.state === "paused") {
					await sb.Config.set("SONG_REQUESTS_VLC_PAUSED", true);
				}
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
				await sb.Query.getRecordUpdater(rs => rs
					.update("chat_data", "Song_Request")
					.set("Status", "Inactive")
					.set("Ended", new sb.Date())
					.where("Status = %s", "Current")
					.where("VLC_ID = %n", ID)
				);

				await client.playlistDelete(ID);
			}
			if (nextTrack) {
				const ID = await sb.Query.getRecordset(rs => rs
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

				const row = await sb.Query.getRow("chat_data", "Song_Request");
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
			const previousIDs = prev.children[0].children.map(i => Number(i.id));
			const nextIDs = next.children[0].children.map(i => Number(i.id));

			const missingIDs = previousIDs.filter(id => !nextIDs.includes(id));
			if (missingIDs.length > 0) {
				await sb.Query.getRecordUpdater(rs => rs
					.update("chat_data", "Song_Request")
					.set("Status", "Inactive")
					.where("VLC_ID IN %n+", missingIDs)
					.where("Status IN %s+", ["Queued", "Current"])
				);
			}
		});

		client.on("error", (err) => {
			console.error(err);
			client.stopRunning();
		});
	}

	get actions () { return this._actions; }

	/**
	 * Sends a raw command to the API. Only used internally.
	 * @private
	 * @param {string} command
	 * @param {Object} [options]
	 * @param {string} parent
	 * @returns {Promise<Object>}
	 */
	async send (command, options = {}, parent) {
		const params = new sb.URLParams();
		for (const key of Object.keys(options)) {
			params.set(key, options[key]);
		}

		if (command) {
			params.set("command", command);
		}

		return await sb.Got({
			prefixUrl: this.baseURL,
			url: parent ?? "",
			searchParams: params.toString(),
			timeout: 1000
		}).json();
	}

	/**
	 * Requests status data from VLC API. Only used internally.
	 * @private
	 * @param {string} [command]
	 * @param {Object} [options]
	 * @returns {Promise<Object>}
	 */
	async getStatus (command, options) {
		return await this.send(command, options, "status.json");
	}

	/**
	 * Requests playlist data from VLC API. Only used internally.
	 * @private
	 * @param {string} [command]
	 * @param {Object} [options]
	 * @returns {Promise<Object>}
	 */
	async getPlaylist (command, options) {
		return (await this.send(command, options, "playlist.json")).children[0];
	}

	async status () { return await this.getStatus(); }
	async playlist () { return await this.getPlaylist(); }

	async previous () { return await this.getStatus("pl_previous"); }
	async next () { return await this.getStatus("pl_next"); }
	async delete (id) { return await this.getStatus("pl_delete", { id }); }

	/**
	 * Adds a video to the playlist queue.
	 * @param {string} link
	 * @param {Object} options={}
	 * @param {number} [options.startTime] Automatic seek to a given position after start, if queued to a empty playlist
	 * @param {number} [options.endTime] Automatic seek to a given position while run ning, if queued to a empty playlist
	 * @returns {Promise<number>}
	 */
	async add (link, options = {}) {
		const status = await this.status();
		if (status.currentplid === -1) {
			await this.getStatus("in_play", { input: link });
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

		return Math.max(...(await this.getPlaylist()).children.map(i => i.id));
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

	/**
	 * Deletes the last video queued by a certain user.
	 * Used when the user queues a song they didn't want to queue.
	 * Returns void if the user was not found or that user has no active requests.
	 * Returns song name if the deletion was successful.
	 * @param {number} user ID
	 * @returns {Promise<void|string>}
	 */
	async wrongSong (user) {
		const userData = await sb.User.get(user);
		if (!userData) {
			return { success: false, reason: "no-user" };
		}

		const userRequests = this.videoQueue.filter(i => i.user === userData.ID);
		if (userRequests.length === 0) {
			return { success: false, reason: "no-requests" };
		}

		const playingData = await this.currentlyPlayingData();
		if (!playingData || !Number(playingData.vlcID)) {
			playingData.vlcID = -Infinity;
		}

		try {
			const [firstUserSong] = userRequests
				.filter(i => i.vlcID >= playingData.vlcID)
				.sort((a, b) => a.vlcID - b.vlcID);

			const link = sb.Utils.linkParser.parseLink(firstUserSong.link);
			const deletedSongData = await this.getDataByName(firstUserSong.name, link);
			await this.delete(deletedSongData.id);

			return { success: true, song: deletedSongData };
		}
		catch (e) {
			console.error(e);
			return { success: false, reason: "delete-failed" };
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

		const targetURL = sb.Utils.linkParser.parseLink(status.information.category.meta.url);
		return this.videoQueue.find(songData => {
			try {
				const songURL = sb.Utils.linkParser.parseLink(songData.link);
				return songURL === targetURL;
			}
			catch {
				return songData.link === targetURL;
			}
		});
	}

	getNormalizedPlaylist () {
		return sb.Query.getRecordset(rs => rs
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
		return this.client._playlist?.children?.[0]?.children ?? [];
	}

	get currentPlaylistItem () {
		const list = this.currentPlaylist.slice();
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
