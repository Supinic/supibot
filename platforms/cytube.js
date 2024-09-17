let CytubeConnector;
class CytubeClient {
	/** @type {CytubeConnector} */
	client = null;
	/** @type {CytubePlatform} */
	platform = null;
	channelData = null;
	emotes = [];
	playlistData = [];
	currentlyPlaying = null;
	restarting = false;

	/** @type {Map<string, CytubeUserPresence>} */
	userMap = new Map();

	/**
	 * @param {Channel} channelData
	 * @param {CytubePlatform} platform
	 */
	constructor (channelData, platform) {
		this.channelData = channelData;
		this.platform = platform;

		this.initialize();
	}

	async initialize () {
		if (this.client) {
			console.warn("Attempting to re-initialize a running Cytube client", {
				channel: this.channelData.Name
			});

			return;
		}

		if (!CytubeConnector) {
			const ConnectorModule = await import("cytube-connector");
			CytubeConnector = ConnectorModule.default;
		}

		const client = new CytubeConnector({
			host: "cytu.be",
			port: 443,
			auth: process.env.CYTUBE_BOT_PASSWORD,
			secure: true,
			user: this.platform.selfName,
			chan: this.channelData.Name
		});

		this.client = client;
		if (typeof this.client.connect === "function") {
			await this.client.connect();
		}

		client.on("clientready", () => {
			this.restarting = false;
		});

		// User list initialize event - save current user data
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
			const threshold = this.platform.config.messageDelayThreshold ?? 30_000;
			if (data.time && difference > threshold) {
				return;
			}

			// user is shadow-banned - do not respond or log or anything
			if (data.meta.shadow) {
				return;
			}

			const originalUsername = data.username;
			data.username = data.username.toLowerCase();

			const msg = sb.Utils.fixHTML(data.msg).replace(/<(?:.|\n)*?>/gm, "");
			if (!msg) {
				return; // Ignore if the result message becomes empty string (HTML issues, seemingly)
			}

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
					platform: this.platform,
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
				const identifiers = sb.Platform.list.map(i => i.mirrorIdentifierr);
				if (originalUsername === this.platform.selfName && identifiers.includes(Array.from(msg)[0])) {
					return;
				}

				if (!this.channelData.sessionData) {
					this.channelData.sessionData = {};
				}

				this.platform.resolveUserMessage(this.channelData, userData, msg);

				this.channelData.events.emit("message", {
					type: "message",
					message: msg,
					user: userData,
					channel: this.channelData,
					platform: this.platform
				});

				if (this.channelData.Logging.has("Meta")) {
					await sb.Logger.updateLastSeen({
						userData,
						channelData: this.channelData,
						message: msg
					});
				}
				if (this.platform.logging.messages && this.channelData.Logging.has("Lines")) {
					await sb.Logger.push(msg, userData, this.channelData);
				}

				if (this.channelData.Mode === "Read") {
					return;
				}
				else if (data.username === this.platform.selfName) {
					return;
				}

				await Promise.all([
					sb.AwayFromKeyboard.checkActive(userData, this.channelData),
					sb.Reminder.checkActive(userData, this.channelData)
				]);

				if (this.channelData.Mirror) {
					this.platform.mirror(msg, userData, this.channelData, { commandUsed: false });
				}

				this.platform.incrementMessageMetric("read", this.channelData);
			}
			else {
				if (this.platform.logging.whispers) {
					await sb.Logger.push(msg, userData, null, this.platform);
				}

				this.platform.resolveUserMessage(null, userData, msg);
				this.platform.incrementMessageMetric("read", null);
			}

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

			this.playlistData.push({
				media,
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
		client.on("disconnect", () => this.restart());

		client.on("error", (err) => {
			console.warn("Cytube error", {
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
			platform: this.platform,
			privateMessage: Boolean(replyIntoPM)
		};

		const execution = await sb.Command.checkAndExecute(command, args, this.channelData, userData, options);
		if (!execution || !execution.reply) {
			return;
		}

		const commandOptions = sb.Command.extractMetaResultProperties(execution);
		if (execution.replyWithPrivateMessage || replyIntoPM) {
			await this.pm(execution.reply, userData.Name);
		}
		else {
			if (this.channelData.Mirror) {
				await this.mirror(execution.reply, userData, {
					...commandOptions,
					commandUsed: true
				});
			}

			const message = await this.platform.prepareMessage(execution.reply, channelData, {
				...commandOptions,
				skipBanphrases: true
			});

			if (message) {
				await this.send(message);
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
		const messageLimit = this.platform.messageLimit;
		const lengthRegex = new RegExp(`.{1,${messageLimit}}`, "g");
		let arr = message
			.replace(/(\r?\n)/g, " ")
			.replace(/\s{2,}/g, " ")
			.match(lengthRegex) || ["<empty message>"];

		if (arr.length > 3) {
			arr = arr.slice(0, 3);
			arr[2] = `${arr[2].slice(0, messageLimit - 3)}...`;
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
			type,
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

		this.platform = null;
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

const DEFAULT_LOGGING_CONFIG = {
	whispers: true,
	messages: true
};
const DEFAULT_PLATFORM_CONFIG = {
	messageDelayThreshold: 30000
};

module.exports = class CytubePlatform extends require("./template.js") {
	/** @type {Map<Channel, CytubeClient>} */
	clients = new Map();

	constructor (config) {
		super("cytube", config, {
			logging: DEFAULT_LOGGING_CONFIG,
			platform: DEFAULT_PLATFORM_CONFIG
		});
	}

	async connect () {
		if (!process.env.CYTUBE_BOT_PASSWORD) {
			throw new sb.Error({
				message: "No Cytube account password configured (CYTUBE_BOT_PASSWORD)"
			});
		}

		const eligibleChannels = sb.Channel.getJoinableForPlatform(this);
		const promises = [];
		for (const channelData of eligibleChannels) {
			promises.push(this.joinChannel(channelData));
		}

		await Promise.all(promises);
	}

	/**
	 * Sends a message through a client specified by provided channel data.
	 * @param {string} message
	 * @param {Channel} channelData
	 */
	async send (message, channelData) {
		const client = this.clients.get(channelData.ID);
		if (!client) {
			throw new sb.Error({
				message: "No client found for Cytube channel",
				args: {
					channelID: channelData.ID,
					channelName: channelData.Name
				}
			});
		}

		await client.send(message);
		this.incrementMessageMetric("sent", channelData);
	}

	/**
	 * Sends a private message through a client specified by provided channel data.
	 * @param {string} message Private message
	 * @param {string} user User the private message will be sent to
	 * @param {Channel} channelData
	 */
	async pm (message, user, channelData) {
		const client = this.clients.get(channelData.ID);
		if (!client) {
			throw new sb.Error({
				message: "No client found for Cytube channel",
				args: {
					channelID: channelData.ID,
					channelName: channelData.Name
				}
			});
		}

		await client.pm(message, user);
		this.incrementMessageMetric("sent", null);
	}

	/**
	 * @override
	 * Platform will not mirror server messages, as on Cytube,
	 * they are considered to be identical to regular chat messages.
	 * @param {string} message
	 * @param {User|null} userData
	 * @param {Channel} channelData
	 * @param {Object} [options]
	 * @param {boolean} [options.commandUsed] = false
	 */
	mirror (message, userData, channelData, options = {}) {
		if (userData && userData.Name === "[server]") {
			return;
		}

		return super.mirror(message, userData, channelData, options);
	}

	/**
	 * Joins a Cytube room.
	 * @param {Channel} channelData
	 * @returns {boolean} True if the channel was joined, false if it was joined before.
	 */
	async joinChannel (channelData) {
		if (this.clients.has(channelData)) {
			return false;
		}

		const client = new CytubeClient(channelData, this);
		await client.initialize();

		this.clients.set(channelData.ID, client);

		return true;
	}

	/**
	 * Fetches the userlist for a given cytube client.
	 * @param {string} channelIdentifier
	 * @returns {string[]}
	 */
	populateUserList (channelIdentifier) {
		const channelData = sb.Channel.get(channelIdentifier, this.platform);
		const client = this.clients.get(channelData.ID);
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
		const client = this.clients.get(channelData.ID);
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

	async populateGlobalEmotes () { return []; }
	fetchInternalPlatformIDByUsername (userData) { return userData.Name; }
	fetchUsernameByUserPlatformID (userPlatformId) { return userPlatformId; }

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
