import { CytubeConnector, EmoteObject, UserObject, QueueObject, VideoObject } from "cytube-connector";

import { Platform, BaseConfig, MirrorOptions } from "./template.js";
import { Channel, Emote } from "../classes/channel.js";
import User from "../classes/user.js";
import { SupiDate, SupiError } from "supi-core";
import { Command } from "../classes/command.js";

type PlaylistObject = VideoObject | {
	media: VideoObject["media"];
	user: UserObject["name"];
	uid: VideoObject["uid"];
	after: QueueObject["after"];
};

class CytubeClient {
	readonly client: CytubeConnector;
	readonly platform: CytubePlatform;
	readonly channelData: Channel;

	private readonly playlistData: PlaylistObject[] = [];
	private readonly userMap: Map<UserObject["name"], UserObject> = new Map();

	public currentlyPlaying: PlaylistObject | null = null;
	private restarting = false;

	private _emotes: Emote[] = [];

	/**
	 * @param {Channel} channelData
	 * @param {CytubePlatform} platform
	 */
	constructor (channelData: Channel, platform: CytubePlatform) {
		this.channelData = channelData;
		this.platform = platform;

		this.client = new CytubeConnector({
			host: "cytu.be",
			port: 443,
			auth: process.env.CYTUBE_BOT_PASSWORD,
			secure: true,
			user: this.platform.selfName,
			chan: this.channelData.Name
		});
	}

	async initialize () {
		const client = this.client;

		client.on("clientready", () => {
			this.restarting = false;
		});

		// User list initialize event - save current user data
		client.on("userlist", (data) => {
			for (const record of data) {
				record.name = record.name.toLowerCase();
				this.userMap.set(record.name, record);
			}
		});

		// Playlist initialize event - save current playlist data
		client.on("playlist", (data) => {
			for (const video of data) {
				this.playlistData.push(video);
			}
		});

		// Handle chat message, log it if needed, handle command if needed
		client.on("chatMsg", async (data) => {
			// Problem: Sometimes, cytube sends messages in batches, as if it was lagging.
			// This block of code then removes legitimate messages.
			// Need to figure out a good limit, or a better solution overall.

			// On login, cytube sends a couple of history messages - skip those
			const difference = (SupiDate.now() - data.time);
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

			const msg = sb.Utils.fixHTML(data.msg).replaceAll(/<(?:.|\n)*?>/gm, "");
			if (!msg) {
				return; // Ignore if the result message becomes empty string (HTML issues, seemingly)
			}

			const userData = await User.get(data.username, false);
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
				const identifiers = Platform.getList().map(i => i.mirrorIdentifier);
				if (originalUsername === this.platform.selfName && identifiers.some(i => msg.startsWith(i))) {
					return;
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
					void this.platform.mirror(msg, userData, this.channelData, { commandUsed: false });
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
					.replaceAll(/\s+/g, " ")
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
			data.name = data.name.toLowerCase();
			this.userMap.set(data.name, data);
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

			this._emotes = emoteList.map(i => CytubeClient.parseEmote(i));
		});

		client.on("updateEmote", (emote) => {
			const exists = this._emotes.find(i => i.name === emote.name);
			if (!exists) {
				const emoteData = CytubeClient.parseEmote(emote);
				this._emotes.push(emoteData);
			}
			else {
				exists.animated = Boolean(emote.image && emote.image.includes(".gif"));
			}
		});

		client.on("renameEmote", (emote) => {
			const exists = this._emotes.find(i => i.name === emote.old);
			if (exists) {
				exists.name = emote.name;
			}
		});

		client.on("removeEmote", (emote) => {
			const index = this._emotes.findIndex(i => i.name === emote.name);
			if (index !== -1) {
				this._emotes.splice(index, 1);
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

		await client.connect();
	}

	/**
	 * Handles the execution of a command and the reply should it be successful.
	 * @param command Command name - will be parsed
	 * @param user User who executed the command
	 * @param [args] Possible arguments for the command
	 * @param [replyIntoPM] If true, the command result will be sent via PM
	 */
	async handleCommand (command: string, user: User, args: string[] = [], replyIntoPM: boolean = false)  {
		const channelData = this.channelData;
		const userData = await sb.User.get(user, false);
		const options = {
			platform: this.platform,
			privateMessage: Boolean(replyIntoPM)
		};

		const execution = await Command.checkAndExecute(command, args, this.channelData, userData, options);
		if (!execution || !execution.reply) {
			return;
		}

		const commandOptions = sb.Command.extractMetaResultProperties(execution);
		if (execution.replyWithPrivateMessage || replyIntoPM) {
			await this.pm(execution.reply, userData.Name);
		}
		else {
			if (this.channelData.Mirror) {
				await this.platform.mirror(execution.reply, userData, {
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
	 */
	async send (message: string) {
		const messageLimit = this.platform.messageLimit;
		const lengthRegex = new RegExp(`.{1,${messageLimit}}`, "g");
		let arr: string[] = message
			.replaceAll(/(\r?\n)/g, " ")
			.replaceAll(/\s{2,}/g, " ")
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
	 * @param message Private message
	 * @param userData User the private message will be sent to
	 */
	async pm (message: string, userData: User) {
		this.client.pm({
			msg: message,
			to: userData.Name
		});
	}

	async queue (type: string, videoID: string) {
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
	 */
	fetchUserList (): string[] {
		return [...this.userMap.keys()];
	}

	async restart () {
		if (this.restarting) {
			return;
		}

		this.restarting = true;

		await this.client.connect();
		await this.initialize();

		this.restarting = false;
	}

	destroy () {
		this.client.destroy();
		this.userMap.clear();
	}

	get emotes () { return [...this._emotes]; }

	static parseEmote (emote: EmoteObject): Emote {
		return {
			ID: emote.name,
			name: emote.name,
			type: "cytube",
			global: false,
			animated: Boolean(emote.image && emote.image.includes(".gif"))
		};
	}
}

const DEFAULT_LOGGING_CONFIG = {
	whispers: true,
	messages: true
};
const DEFAULT_PLATFORM_CONFIG = {
	messageDelayThreshold: 30000
};

interface CytubeConfig extends BaseConfig {
	platform: {
		messageDelayThreshold?: number;
	};
	logging: {
		messages?: boolean;
		whispers?: boolean;
	};
}

export class CytubePlatform extends Platform<CytubeConfig> {
	private readonly clients: Map<Channel["ID"], CytubeClient> = new Map();

	constructor (config: CytubeConfig) {
		const resultConfig = { ...config };
		if (typeof resultConfig.logging.messages !== "boolean") {
			resultConfig.logging.messages = DEFAULT_LOGGING_CONFIG.messages;
		}
		if (typeof resultConfig.logging.whispers !== "boolean") {
			resultConfig.logging.whispers = DEFAULT_LOGGING_CONFIG.whispers;
		}
		if (typeof resultConfig.platform.messageDelayThreshold !== "number") {
			resultConfig.platform.messageDelayThreshold = DEFAULT_PLATFORM_CONFIG.messageDelayThreshold;
		}

		super("cytube", resultConfig);
	}

	async connect () {
		if (!process.env.CYTUBE_BOT_PASSWORD) {
			throw new SupiError({
				message: "No Cytube account password configured (CYTUBE_BOT_PASSWORD)"
			});
		}

		const eligibleChannels = Channel.getJoinableForPlatform(this);
		const promises = [];
		for (const channelData of eligibleChannels) {
			promises.push(this.joinChannel(channelData));
		}

		await Promise.all(promises);
	}

	/**
	 * Sends a message through a client specified by provided channel data.
	 */
	async send (message: string, channelData: Channel) {
		const client = this.clients.get(channelData.ID);
		if (!client) {
			throw new SupiError({
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
	 */
	async pm (message: string, user: User, channelData: Channel) {
		const client = this.clients.get(channelData.ID);
		if (!client) {
			throw new SupiError({
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
	async mirror (message: string, userData: User, channelData: Channel, options: MirrorOptions = {}) {
		if (userData && userData.Name === "[server]") {
			return;
		}

		return super.mirror(message, userData, channelData, options);
	}

	/**
	 * Joins a Cytube room.
	 * @returns True if the channel was joined, false if it was already joined before.
	 */
	async joinChannel (channelData: Channel) {
		if (this.clients.has(channelData.ID)) {
			return false;
		}

		const client = new CytubeClient(channelData, this);
		await client.initialize();

		this.clients.set(channelData.ID, client);

		return true;
	}

	async populateUserList (channelData: Channel): Promise<string[]> {
		const client = this.clients.get(channelData.ID);
		if (!client) {
			throw new SupiError({
				message: "No client found for Cytube channel",
				args: {
					channelID: channelData.ID,
					channelName: channelData.Name
				}
			});
		}

		return client.fetchUserList();
	}

	async fetchChannelEmotes (channelData: Channel): Promise<Emote[]> {
		const client = this.clients.get(channelData.ID);
		if (!client) {
			throw new SupiError({
				message: "No client found for Cytube channel",
				args: {
					channelID: channelData.ID,
					channelName: channelData.Name
				}
			});
		}

		return client.emotes;
	}

	destroy () {
		for (const client of this.clients.values()) {
			client.destroy();
		}

		this.clients.clear();
	}

	async populateGlobalEmotes () { return []; }
	fetchInternalPlatformIDByUsername (userData: User) { return userData.Name; }
	async fetchUsernameByUserPlatformID (userPlatformId: string) { return userPlatformId; }
	async createUserMention (userData: User) { return userData.Name; }
	initListeners () {}
	isChannelLive () { return null; }
	isUserChannelOwner () { return null; }
}

export default CytubePlatform;
