/* global sb */
module.exports = (function () {
	"use strict";

	const { VLC } = require("node-vlc-http");
	const actions = [
		"addToQueue",
		"addToQueueAndPlay",
		"addSubtitle",
		"play",
		"pause",
		"stop",
		"resume",
		"forcePause",
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

	return class VideoLANConnector {
		static singleton () {
			if (!VideoLANConnector.module) {
				VideoLANConnector.module = new VideoLANConnector({
					baseURL: sb.Config.get("LOCAL_VLC_BASE_URL"),
					url: "192.168.0.100",
					port: 8080,
					username: "",
					password: "supinic",
				});
			}
			return VideoLANConnector.module;
		}

		/**
		 * Class containing various utility methods that don't fit elsewhere.
		 * @name sb.VideoLANConnector
		 * @type VideoLANConnector()
		 */
		constructor (options = {}) {
			this.client = new VLC({
				host: options.url,
				port: options.port,
				username: options.username,
				password: options.password,
				autoUpdate: true,
				changeEvents: true,
				tickLengthMs: 1000,
			});

			this.baseURL = options.baseURL;
			this.videoQueue = [];
			this.requestsID = {};

			this._actions = {};
			for (const action of actions) {
				this._actions[action] = (...args) => this.client[action](...args)
			}

			this.initListeners();
		}

		initListeners () {
			const client = this.client;

			client.on("statuschange", (before, after) => {
				const previous = before.currentplid;
				const next = after.currentplid;

				if (previous !== next) {
					// Playlist is finished, nothing is playing.
					if (next === -1) {
						client.emit("videochange", null);
					}
					// Moving to new song in the queue.
					else {
						client.emit("videochange", this.currentPlaylistItem);
					}
				}
			});

			client.on("videochange", async (nowPlaying) => {
				if (nowPlaying) {
					const id = Number(nowPlaying.id);
					await sb.Query.getRecordUpdater(rs => rs
						.update("chat_data", "Song_Request")
						.set("Status", "Inactive")
						.where("Status = %s", "Current")
						.where("VLC_ID <> %n", id)
					);
					await sb.Query.getRecordUpdater(rs => rs
						.update("chat_data", "Song_Request")
						.set("Status", "Current")
						.where("VLC_ID = %n", id)
						.where("Status = %s", "Queued")
					);
				}
				else {
					await sb.Query.getRecordUpdater(rs => rs
						.update("chat_data", "Song_Request")
						.set("Status", "Inactive")
						.where("Status = %s", "Current")
					);
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
		async delete (id) { return await this.getStatus("pl_delete", { id: id }); }

		/**
		 * Adds a video to the playlist queue.
		 * @param {string} link
		 * @param {number} user
		 * @param {YoutubeDataObject} data
		 * @returns {Promise<number>}
		 */
		async add (link, user, data) {
			const status = await this.status();
			if (status.currentplid === -1) {
				await this.getStatus("in_play", {input: link});
			}
			else {
				await this.getStatus("in_enqueue", {input: link});
			}

			const newID = Math.max(...(await this.getPlaylist()).children.map(i => i.id));

			this.requestsID[user] = this.requestsID[user] || [];
			this.requestsID[user].push(newID);

			this.videoQueue.push({
				vlcID: newID,
				user: user,
				link: link,
				length: data.duration || data.length,
				name: data.name,
				requested: new sb.Date()
			});

			return newID;
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
				const firstUserSong = userRequests
					.filter(i => i.vlcID >= playingData.vlcID)
					.sort((a, b) => a.vlcID - b.vlcID)
					[0];

				const link = sb.Utils.linkParser.parseLink(firstUserSong.link);
				const deletedSongData = await this.getDataByName(firstUserSong.name, link );
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

		async getDataByName (name, link) {
			const playlist = await this.playlist();
			return playlist.children.find(i => i.name === name || i.name === link);
		}
		get currentPlaylist () {
			return this.client._playlist?.children?.[0]?.children ?? [];
		}

		get currentPlaylistItem () {
			return this.currentPlaylist.find(i => (
				i.current === "current"
				|| Array.isArray(i.children) && i.children.some(j => j.current === "current")
			)) ?? null;
		}

		get modulePath () { return "vlc-connector"; }

		/*
		async playlistLength (id) {
			const status = await VLC.status();
			const playlist = await VLC.playlist();

			if (status.currentplid === -1) {
				return {
					length: 0,
					amount: 0
				};
			}

			if (typeof id !== "number") {
				id = playlist.children.find(i => i.current).id;
			}

			let amount = 1;
			let length = Number(status.length) - Number(status.time);
			for (const song of playlist.children) {
				if (song.id <= id) {
					continue;
				}
				amount++;
				length += Number(VLC.extraData[song.id - 1].length);
			}
			return {
				length: length,
				amount: amount
			};
		}
		*/

		/*
		async userPendingQueue (user) {
			this.requestsID[user] = this.requestsID[user] || [];
			const currentID = await this.currentlyPlaying(true);
			return this.requestsID[user].filter(songID => (songID >= currentID)).length;
		}
		*/
	};
});