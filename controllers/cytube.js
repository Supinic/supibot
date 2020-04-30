/* global sb */
// @todo refactor Master and Cytube so that Cytube handles multiple channels, instead of Master managing that
// @todo after this is done, create a common Client class all sub-clients extend

const CytubeConnector = require("cytube-connector");

module.exports = class Cytube extends require("./template.js") {
	constructor () {
		super();

		this.platform = sb.Platform.get("cytube");
		if (!this.platform) {
			throw new sb.Error({
				message: "Cytube platform has not been created"
			});
		}
		else if (!sb.Config.has("CYTUBE_BOT_PASSWORD", true)) {
			throw new sb.Error({
				message: "Cytube password has not been configured"
			});
		}

		this.client = new CytubeConnector({
			host: "cytu.be",
			port: 443,
			secure: true,
			user: this.platform.Self_Name,
			auth: sb.Config.get("CYTUBE_BOT_PASSWORD"),
			chan: "forsenoffline" // @todo change this to be flexible
		});

		this.restartInterval = null;
		this.restartDelay = 60000;
		this.restarting = false;

		// @todo assign each channel to a separate "room"
		this.channels = [];
		this.channelData = sb.Channel.get("forsenoffline"); // @todo change this

		this.userMap = new Map();
		this.playlistData = [];
		this.currentlyPlaying = null;

		this.initListeners();
	}

	initListeners () {
		const client = this.client;

		client.on("clientready", () => {
			clearInterval(this.restartInterval);
			this.restarting = false;
		});

		// Userlist initialize event - save current user data
		client.on("userlist", (data = []) => {
			for (const record of data) {
				if (typeof record.name === "string") {
					record.name = record.name.toLowerCase();
					this.userMap.set(record.name, record);
				}
			}
		});

		// Playlist initialize event - save current playlist data
		client.on("playlist", (data = []) => {
			for (const video of data) {
				this.playlistData.push(video);
			}
		});

		// Disconnect event fired - restart and reconnect
		client.on("disconnect", () => {
			sb.SystemLogger.send("Cytube.Restart", "Disconnected");
			this.restart();
		});

		// Handle chat message, log it if needed, handle command if needed
		// { username: 'KUNszg',
		//   msg: '$wiki tunguska event',
		//   meta: {},
		//   time: 1550780467657 }
		client.on("chatMsg", async (data) => {
			// Problem: Sometimes, cytube sends messages in batches, as if it was lagging.
			// This block of code then removes legitimate messages.
			// Need to figure out a good limit, or a better solution overall.
			// On login, cytube sends a couple of history messages - skip those
			const difference = (sb.Date.now() - data.time);
			if (data.time && difference > 60.0e3) {
				return;
			}

			// user is shadowbanned - do not respond or log or anything
			if (data.meta.shadow) {
				return;
			}

			const originalUsername = data.username;
			data.username = data.username.toLowerCase();

			const msg = sb.Utils.fixHTML(data.msg).replace(/<(?:.|\n)*?>/gm, "");
			const userData = await sb.User.get(data.username, false);
			const platformUserData = (data.username === "[server]")
				? { rank: -1 }
				: this.userMap.get(data.username);

			if (!userData) {
				return;
			}
			else if (!platformUserData) {
				client.getUserList();
				return;
			}
			else if (platformUserData.rank === 0) {
				console.warn("Cytube: user rank too low", { data, platformUserData });
				return;
			}

			// Only unset AFK and fire reminders if the message wasn't private
			if (!data.meta.private) {
				// Do not process mirrored messages
				const identifiers = sb.Platform.data.map(i => i.Mirror_Identifier);
				if (originalUsername === this.platform.Self_Name && identifiers.includes(Array.from(msg)[0])) {
					return;
				}
				
				sb.Logger.push(msg, userData, this.channelData);
				sb.AwayFromKeyboard.checkActive(userData, this.channelData);
				sb.Reminder.checkActive(userData, this.channelData);

				if (this.channelData.Mirror) {
					this.mirror(msg, userData, false);
				}
			}
			else {
				sb.SystemLogger.send("Cytube.Other", "PM: " + msg, this.channelData, userData);
			}

			sb.Master.globalMessageListener(
				this.platform,
				(data.meta.private) ? null : this.channelData,
				userData,
				msg
			);

			// Handle commands if the message starts with the command prefix
			if (msg.startsWith(sb.Master.commandPrefix)) {
				const arg = msg.trim().replace(/\s+/, " ").split(" ");
				const command = arg.shift().slice(sb.Master.commandPrefix.length);

				this.handleCommand(command, userData, arg, data.meta.private);
			}
		});

		// Set message as private and treat it like a regular chat message concerning command usage
		client.on("pm", (data) => {
			data.meta.private = true;
			client.emit("chatMsg", data);
		});

		// { item: { media: { id, title, seconds, duration, type, meta: {} }, uid, temp, queueby }, after }
		client.on("queue", async (data) => {
			const who = data.item.queueby.toLowerCase();
			const media = data.item.media;
			if (who === this.platform.Self_Name) {
				return;
			}

			const userData = await sb.User.get(who, false);
			sb.Logger.logVideoRequest(media.id, media.type, media.seconds, userData, this.channelData);

			this.playlistData.push({
				media: media,
				user: who,
				uid: data.item.uid,
				after: data.after
			});
		});

		// User joined channel
		client.on("addUser", async (data) => {
			if (typeof data.name === "string") {
				data.name = data.name.toLowerCase();
				this.userMap.set(data.name, data);
			}
		});

		// User left channel
		client.on("userLeave", (data) => {
			data.name = data.name.toLowerCase();
			this.userMap.delete(data.name);
		});

		// Video deleted from queue by moderator
		client.on("delete", (data) => {
			const index = this.playlistData.findIndex(i => i.uid === data.uid);
			if (index !== -1) {
				this.playlistData.splice(index, 1);
			}
		});

		// Video finished playing
		client.on("changeMedia", () => {
			this.currentlyPlaying = this.playlistData.shift() ?? null;
		});

		client.on("queue", (data) => {
			// console.log("Cytube queued video", data);
		});

		client.on("error", (err) => {
			console.error("Cytube error", err);

			if (this.restarting) {
				return;
			}

			this.restarting = true;
			this.restartInterval = setTimeout(() => this.restart(), this.restartDelay);

			// if (!this._restarting) {
			// 	setTimeout(() => this.restart(), 20e3);
			// }
			//
			// this._restarting = true;
		});

		/**
		 * @param {Object} data Emote data
		 * @param {string} data.name Emote name
		 * @param {string} data.image Emote URL
		 * @param {string} data.source Regex to replace text with emote in chat
		 */
		client.on("updateEmote", (data) => {
			// @todo fix this to use something thats not request thanks

			// const request = require("request");
			// const fs = require("fs");
			// const filename = data.name + "-" + data.image.replace(/\//g, "-");
			//
			// request(data.image).pipe(fs.createWriteStream("/code/emotes/" + filename));
		});
	}

	/**
	 * Sends a message to current channel bound to this instance.
	 * Works by splitting the message into 200 character chunks and sending them repeatedly in order.
	 * This is done because (for whatever reason) Cytube implements a tiny character limit, at least compared to other clients.
	 * @param {string} message
	 * @param {Channel} channelData
	 */
	send (message, channelData) {
		if (channelData && this.channels.length > 0) {
			// @todo separate room handling for multiple channels
		}

		const messageLimit = this.platform.Message_Limit;
		const lengthRegex = new RegExp(".{1," + messageLimit + "}", "g");
		let arr = message
			.replace(/(\r?\n)/g, " ")
			.replace(/\s{2,}/g, " ")
			.match(lengthRegex) || ["<empty message>"];

		if (arr.length > 3) {
			arr = arr.slice(0, 3);
			arr[2] = arr[2].slice(0, messageLimit - 3) +  "...";
		}

		let index = 0;
		for (const partialMessage of arr) {
			setTimeout(() => this.client.chat({
				msg: partialMessage,
				meta: {}
			}), index * 10);

			index++;
		}
	}

	/**
	 * Sends a private message in the context of current channel bound to this instance
	 * @param {string} user User the private message will be sent to
	 * @param {string} message Private message
	 * @param {Object} [meta] Meta info
	 */
	pm (user, message, meta = {}) {
		this.client.pm({
			msg: message,
			to: user,
			meta: meta
		});
	}

	/**
	 * Handles the execution of a command and the reply should it be successful.
	 * @param {string} command Command name - will be parsed
	 * @param {string} user User who executed the command
	 * @param {Array} [args] Possible arguments for the command
	 * @param {boolean} [replyIntoPM] If true, the command result will be sent via PM
	 * @returns {Promise<void>}
	 */
	async handleCommand (command, user, args = [], replyIntoPM) {
		const channelData = this.channelData;
		const userData = await sb.User.get(user, false);
		const options = {
			platform: this.platform,
			privateMessage: Boolean(replyIntoPM)
		};

		const execution = await sb.Command.checkAndExecute(command, args, this.channelData, userData, options);
		if (!execution || !execution.reply) {
			return;
		}

		if (execution.replyWithPrivateMessage || replyIntoPM) {
			this.pm(userData.Name, execution.reply);
		}
		else {
			if (this.channelData.Mirror) {
				this.mirror(execution.reply, userData, true);
			}

			const message = await sb.Master.prepareMessage(execution.reply, channelData, { skipBanphrases: true });
			if (message) {
				this.send(message);
			}
		}
	}

	/**
	 * Sets the message to be mirrored to a mirror channel.
	 * @param {string} message
	 * @param {User} userData.
	 * @param {boolean} commandUsed
	 */
	mirror (message, userData, commandUsed = false) {
		if (userData.Name === "[server]") {
			return;
		}
		
		const fixedMessage = (commandUsed)
			? `${this.platform.Mirror_Identifier} ${message}`
			: `${this.platform.Mirror_Identifier} ${userData.Name}: ${message}`;

		sb.Master.mirror(fixedMessage, userData, this.channelData.Mirror);
	}

	/**
	 * Closes the connection and sets up to create a new one
	 */
	restart () {
		// @todo: only restart one cytube client, not all of them (different hosts possible?)
		sb.Master.reloadClientModule(this.platform);
		this.destroy();
	}

	/**
	 * Destroys and cleans up the instance
	 */
	destroy () {
		this.client = null;
	}
};

/**
 * @typedef {string} Event
 * @value ("clientready")
 */

/* Unused handlers (for now)
// this.on("rank", (rank) => { this.handleRank(rank) }); // This is self rank
// this.on("usercount", (count) => { this.handleUserCount(count) });

// this.on("userlist", (list) => { this.handleUserList(list) });
// this.on("addUser", (user) => { this.handleUserAdd(user) });
// this.on("setAFK", (user) => { this.handleUserAFK(user) });
// this.on("setLeader", (user) => { this.handleUserLeader(user) });
// this.on("setUserMeta", (user) => { this.handleUserMeta(user) });
// this.on("setUserProfile", (user) => { this.handleUserProfile(user) });
// this.on("setUserRank", (user) => { this.handleUserRank(user) });
// this.on("userLeave", (user) => { this.handleUserRemove(user) });

// this.on("emoteList", (list) => { this.handleEmoteList(list) });
// this.on("updateEmote", (emote) => { this.handleEmoteUpdate(emote) });
// this.on("removeEmote", (emote) => { this.handleEmoteRemove(emote) });
// this.on("renameEmote", (emote) => { this.handleEmoteRename(emote) });

// this.on("playlist", (list) => { this.handlePlaylist(list) });
// this.on("setPlaylistLocked", (data) => { this.handlePlaylistLocked(data) });
// this.on("setPlaylistMeta", (data) => { this.handlePlaylistMeta(data) });
// this.on("listPlaylists", (data) => { this.handleListPlaylists(data) });
// this.on("delete", (data) => { this.handleVideoDelete(data) });
// this.on("changeMedia", (data) => { this.handleVideoChange(data) });
// this.on("mediaUpdate", (data) => { this.handleVideoUpdate(data) });
// this.on("moveVideo", (data) => { this.handleVideoMove(data) });
// this.on("queue", (data) => { this.handleVideoQueue(data) });
// this.on("queueFail", (data) => { this.handleVideoQueueFail(data) });
// this.on("queueWarn", (data) => { this.handleVideoQueueWarn(data) });
// this.on("setCurrent", (data) => { this.handleVideoCurrent(data) });
// this.on("setTemp", (data) => { this.handleVideoTemp(data) });

// this.on("banlist", (list) => { this.handleBanList(list) });
// this.on("banlistRemove", (ban) => { this.handleBanRemove(ban) });
// this.on("setPermissions", (chanperms) => { this.handleChanPerms(chanperms) });
// this.on("channelOpts", (chanopts) => { this.handleChanOpts(chanopts) });
// this.on("clearchat", (who) => { this.handleClearChat(who) });
// this.on("drinkCount", (count) => { this.handleDrinkCount(count) });
// this.on("setMotd", (banner) => { this.handleBanner(banner) });

*/