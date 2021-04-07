const CytubeConnector = require("cytube-connector");

class CytubeClient {
	/** @type {CytubeConnector} */
	client = null;
	/** @type {CytubeController} */
	controller = null;
	channelData = null;
	emotes = [];
	playlistData = [];
	currentlyPlaying = null;
	restarting = false;
	restartInterval = null;

	/** @type {Map<string, CytubeUserPresence>} */
	userMap = new Map();

	/**
	 * @param {Channel} channelData
	 * @param {CytubeController} controller
	 */
	constructor (channelData, controller) {
		this.channelData = channelData;
		this.controller = controller;

		this.initialize();
	}

	initialize () {
		if (this.client) {
			console.warn("Attempting to re-initialize a running Cytube client", {
				channel: this.channelData.Name
			});
			return;
		}

		const client = new CytubeConnector({
			host: "cytu.be",
			port: 443,
			secure: true,
			user: this.controller.platform.Self_Name,
			auth: sb.Config.get("CYTUBE_BOT_PASSWORD"),
			chan: this.channelData.Name
		});

		this.client = client;

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
				this.channelData.events.emit("message", {
					event: "message",
					message: msg,
					user: null,
					channel: this.channelData,
					platform: this.controller.platform,
					raw: {
						user: data.username
					}
				});

				return;
			}
			else if (!platformUserData) {
				client.getUserList();
				return;
			}
			else if (platformUserData.rank === 0) { // Ignore "grey" name users - rank too low
				return;
			}

			// Only unset AFK and fire reminders if the message wasn't private
			if (!data.meta.private) {
				// Do not process mirrored messages
				const identifiers = sb.Platform.data.map(i => i.Mirror_Identifier);
				if (originalUsername === this.controller.platform.Self_Name && identifiers.includes(Array.from(msg)[0])) {
					return;
				}

				if (!this.channelData.sessionData) {
					this.channelData.sessionData = {};
				}

				this.channelData.sessionData.lastActivity = {
					user: userData.ID,
					date: new sb.Date().valueOf()
				};

				this.controller.resolveUserMessage(this.channelData, userData, msg);

				sb.Logger.push(msg, userData, this.channelData);
				sb.AwayFromKeyboard.checkActive(userData, this.channelData);
				sb.Reminder.checkActive(userData, this.channelData);

				if (this.channelData.Mirror) {
					this.controller.mirror(msg, userData, this.channelData, false);
				}
			}
			else {
				this.controller.resolveUserMessage(null, userData, msg);

				if (this.controller.platform.Logging.whispers) {
					sb.SystemLogger.send("Cytube.Other", "PM: " + msg, this.channelData, userData);
				}
			}

			this.channelData.events.emit("message", {
				type: "message",
				message: msg,
				user: userData,
				channel: this.channelData,
				platform: this.controller.platform
			});

			// Handle commands if the message starts with the command prefix
			if (sb.Command.is(msg)) {
				const commandPrefix = sb.Command.prefix;
				const [command, ...arg] = msg
					.trim()
					.replace(/\s+/g, " ")
					.replace(commandPrefix, "")
					.split(" ")
					.filter(Boolean);

				await this.handleCommand(command, userData, arg, data.meta.private);
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
			const { media } = data.item;

			const userData = await sb.User.get(who, false);
			if (!userData) {
				return;
			}

			if (this.controller.platform.Logging.videoRequests) {
				await sb.Logger.logVideoRequest(media.id, media.type, media.seconds, userData, this.channelData);
			}

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

		// This listener assumes that the emote list is only ever passed post-login.
		client.on("emoteList", (emoteList) => {
			if (!emoteList) {
				console.warn("emoteList event received no emotes", {
					channelID: this.channelData.ID,
					channelName: this.channelData.Name
				});

				return;
			}

			this.emotes = emoteList.map(CytubeClient.parseEmote);
		});

		client.on("updateEmote", (emote) => {
			const exists = this.emotes.find(i => i.name === emote.name);
			if (!exists) {
				const emoteData = CytubeClient.parseEmote(emote);
				this.emotes.push(emoteData);
			}
			else {
				exists.animated = Boolean(emote.image && emote.image.includes(".gif"));
			}
		});

		client.on("renameEmote", (emote) => {
			const exists = this.emotes.find(i => i.name === emote.old);
			if (exists) {
				exists.name = emote.name;
			}
		});

		client.on("removeEmote", (emote) => {
			const index = this.emotes.findIndex(i => i.name === emote.namw);
			if (index !== -1) {
				this.emotes.splice(index, 1);
			}
		});

		// Disconnect event fired - restart and reconnect
		client.on("disconnect", (...args) => {
			console.log("Cytube client disconnected, restarting", {
				args,
				channel: this.channelData.Name
			});

			this.restart();
		});

		client.on("error", (err) => {
			console.error("Cytube error", {
				err,
				channel: this.channelData.Name
			});
		});
	}

	/**
	 * Handles the execution of a command and the reply should it be successful.
	 * @param {string} command Command name - will be parsed
	 * @param {string} user User who executed the command
	 * @param {string[]} [args] Possible arguments for the command
	 * @param {boolean} [replyIntoPM] If true, the command result will be sent via PM
	 * @returns {Promise<void>}
	 */
	async handleCommand (command, user, args = [], replyIntoPM) {
		const channelData = this.channelData;
		const userData = await sb.User.get(user, false);
		const options = {
			platform: this.controller.platform,
			privateMessage: Boolean(replyIntoPM)
		};

		const execution = await sb.Command.checkAndExecute(command, args, this.channelData, userData, options);
		if (!execution || !execution.reply) {
			return;
		}

		if (execution.replyWithPrivateMessage || replyIntoPM) {
			this.pm(execution.reply, userData.Name);
		}
		else {
			if (this.channelData.Mirror) {
				this.mirror(execution.reply, userData, true);
			}

			const message = await this.controller.prepareMessage(execution.reply, channelData, { skipBanphrases: true });
			if (message) {
				this.send(message);
			}
		}
	}

	/**
	 * Sends a message to current channel bound to this instance.
	 * Works by splitting the message into 200 character chunks and sending them repeatedly in order.
	 * This is done because (for whatever reason) Cytube implements a tiny character limit, at least compared to other clients.
	 * @param {string} message
	 */
	async send (message) {
		const messageLimit = this.controller.platform.Message_Limit;
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
	 * @param {string} message Private message
	 * @param {string} user User the private message will be sent to
	 */
	async pm (message, user) {
		const userData = await sb.User.get(user);
		this.client.pm({
			msg: message,
			to: userData.Name
		});
	}

	/**
	 * Queues a video.
	 * @param {string} type
	 * @param {string} videoID
	 * @returns {Promise<void>}
	 */
	async queue (type, videoID) {
		this.client.socket.emit("queue", {
			id: videoID,
			type: type,
			pos: "end",
			temp: true,
			duration: undefined,
			title: undefined
		});
	}

	/**
	 * Returns a list of currently present chatters/viewers.
	 * @returns {string[]}
	 */
	fetchUserList () {
		return [...this.userMap.keys()];
	}

	restart () {
		if (this.restarting) {
			return;
		}

		this.restarting = true;
		if (this.client) {
			this.client.removeAllListeners();
			this.client.destroy();
			this.client = null;
		}

		this.initialize();
	}

	destroy () {
		this.client.destroy();
		this.client = null;

		this.userMap.clear();
		this.playlistData = null;

		this.controller = null;
	}

	static parseEmote (emote) {
		return {
			ID: null,
			name: emote.name,
			type: "cytube",
			global: false,
			animated: Boolean(emote.image && emote.image.includes(".gif"))
		};
	}
	/**
	 * @typedef {Object} CytubeUserPresence
	 * @property {string} name User name
	 * @property {Object} meta
	 * @property {boolean} meta.afk
	 * @property {string[]} meta.aliases Any additional user name aliases
	 * @property {boolean} meta.muted Mute flag
	 * @property {boolean} meta.smuted Shadowmute flag
	 * @property {Object} profile
	 * @property {string} profile.image Link to user profile picture
	 * @property {string} profile.text Any additional user profile description
	 */
}

module.exports = class CytubeController extends require("./template.js") {
	/** @type {Map<Channel, CytubeClient>} */
	clients = new Map();
	restartDelay = 10000;

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

		const eligibleChannels = sb.Channel.getJoinableForPlatform(this.platform);
		for (const channelData of eligibleChannels) {
			this.joinChannel(channelData);
		}
	}

	/**
	 * Sends a message through a client specified by provided channel data.
	 * @param {string} message
	 * @param {Channel} channelData
	 */
	async send (message, channelData) {
		const client = this.clients.get(channelData);
		if (!client) {
			throw new sb.Error({
				message: "No client found for Cytube channel",
				args: {
					channelID: channelData.ID,
					channelName: channelData.Name
				}
			});
		}

		return await client.send(message);
	}

	/**
	 * Sends a private message through a client specified by provided channel data.
	 * @param {string} message Private message
	 * @param {string} user User the private message will be sent to
	 * @param {Channel} channelData
	 */
	async pm (message, user, channelData) {
		const client = this.clients.get(channelData);
		if (!client) {
			throw new sb.Error({
				message: "No client found for Cytube channel",
				args: {
					channelID: channelData.ID,
					channelName: channelData.Name
				}
			});
		}

		return await client.pm(message, user);
	}

	/**
	 * Sets the message to be mirrored to a mirror channel.
	 * @param {string} message
	 * @param {User} userData
	 * @param {Channel} channelData
	 * @param {boolean} commandUsed = false
	 */
	mirror (message, userData, channelData, commandUsed = false) {
		if (userData.Name === "[server]") {
			return;
		}

		return super.mirror(message, userData, channelData, commandUsed);
	}

	/**
	 * Joins a Cytube room.
	 * @param {Channel} channelData
	 * @returns {boolean} True if the channel was joined, false if it was joined before.
	 */
	joinChannel (channelData) {
		if (this.clients.has(channelData)) {
			return false;
		}

		const client = new CytubeClient(channelData, this);
		this.clients.set(channelData, client);

		return true;
	}

	/**
	 * Fetches the userlist for a given cytube client.
	 * @param {string} channelIdentifier
	 * @returns {string[]}
	 */
	fetchUserList (channelIdentifier) {
		const channelData = sb.Channel.get(channelIdentifier, this.platform);
		const client = this.clients.get(channelData);
		if (!client) {
			throw new sb.Error({
				message: "No client found for Cytube channel",
				args: {
					channelID: channelData.ID,
					channelName: channelData.Name
				}
			});
		}

		return client.fetchUserList();
	}

	async fetchChannelEmotes (channelData) {
		const client = this.clients.get(channelData);
		if (!client) {
			throw new sb.Error({
				message: "No client found for Cytube channel",
				args: {
					channelID: channelData.ID,
					channelName: channelData.Name
				}
			});
		}

		return client.emotes;
	}

	/**
	 * Destroys and cleans up the instance
	 */
	destroy () {
		for (const client of this.clients.values()) {
			client.destroy();
		}

		this.clients.clear();
	}
};