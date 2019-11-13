/* global sb */
module.exports = (function () {
	"use strict";

	const request = require("custom-request-promise");

	return class VideoLANConnector {
		static singleton () {
			if (!VideoLANConnector.module) {
				VideoLANConnector.module = new VideoLANConnector(sb.Config.get("LOCAL_VLC_BASE_URL"));
			}
			return VideoLANConnector.module;
		}

		/**
		 * Class containing various utility methods that don't fit elsewhere.
		 * @name sb.VideoLANConnector
		 * @type VideoLANConnector()
		 */
		constructor (baseURL) {
			this.baseURL = baseURL;
			this.videoQueue = [];
			this.requestsID = {};
		}

		/**
		 * Sends a raw command to the API. Only used internally.
		 * @private
		 * @param {string} command
		 * @param {Object} [options]
		 * @param {string} parent
		 * @returns {Promise<Object>}
		 */
		async send (command = "", options = {}, parent) {
			let requestData = "";
			for (const key of Object.keys(options)) {
				requestData += "&" + key + "=" + encodeURIComponent(options[key]);
			}

			const cmd = (command) ? ("?command=" + command) : "";
			const url = this.baseURL + parent + cmd + requestData;

			return JSON.parse(await request(url));
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

			const newID = Math.max(...(await this.getPlaylist()).children.map(i => i.id)) + 1;

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
			const status = await this.status();
			const targetURL = sb.Utils.linkParser.parseLink(status.information.category.meta.url);

			return this.videoQueue.find(songData => {
				const songURL = sb.Utils.linkParser.parseLink(songData.link);
				return songURL === targetURL;
			});
		}

		async getDataByName (name, link) {
			const playlist = await this.playlist();
			return playlist.children.find(i => i.name === name || i.name === link);
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