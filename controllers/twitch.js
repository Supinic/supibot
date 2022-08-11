const MessageScheduler = require("message-scheduler");
const DankTwitch = require("dank-twitch-irc");

const specialEmoteSetMap = {
	472873131: "300636018", // Haha emotes
	488737509: "300819901", // Luv emotes
	537206155: "301450851", // Pride emotes
	564265402: "301965751", // Hyper emotes
	592920959: "302430190", // KPOP emotes
	610186276: "302778679" // 2020 emotes
};

const emoteGot = sb.Got.get("Global").extend({
	mutableDefaults: true,
	responseType: "json",
	throwHttpErrors: false,
	timeout: 2500,
	retry: 1
});

module.exports = class TwitchController extends require("./template.js") {
	constructor () {
		super();

		this.dynamicChannelAddition = true;

		this.platform = sb.Platform.get("twitch");
		if (!this.platform) {
			throw new sb.Error({
				message: "Twitch platform has not been created"
			});
		}
		else if (!this.platform.Self_Name) {
			throw new sb.Error({
				message: "Twitch platform does not have the bot's name configured"
			});
		}
		else if (!sb.Config.has("TWITCH_OAUTH", true)) {
			throw new sb.Error({
				message: "Twitch oauth token (Config/TWITCH_OAUTH) has not been configured"
			});
		}
		else if (!sb.Config.has("TWITCH_CLIENT_ID", true)) {
			throw new sb.Error({
				message: "Twitch client ID (Config/TWITCH_CLIENT_ID) has not been configured"
			});
		}

		this.client = new DankTwitch.ChatClient({
			username: this.platform.Self_Name,
			password: sb.Config.get("TWITCH_OAUTH"),
			rateLimits: this.platform.Data.rateLimits
		});

		this.queues = {};
		this.evasion = {};
		this.rejectedMessageTimeouts = {};

		this.availableEmotes = [];
		this.availableEmoteSets = [];
		this.recentEmoteFetchTimeout = 0;
		this.userCommandSpamPrevention = new Map();

		this.initListeners();

		this.client.connect();

		const joinOverride = this.platform?.Data.joinChannelsOverride ?? [];
		if (joinOverride.length === 0) {
			this.client.joinAll(sb.Channel.getJoinableForPlatform(this.platform).map(i => i.Name));
		}
		else {
			const channelList = joinOverride
				.map(i => sb.Channel.get(i))
				.filter(Boolean)
				.map(i => i.Name);

			this.client.joinAll(channelList);
		}

		this.data.updatingUserIDPromises = 0;
		this.data.crons = [
			new sb.Cron({
				Name: "channels-live-status",
				Expression: "0 */1 * * * *",
				Description: "Fetches the online status of all active Twitch channels. Basically, just caches the current status so that further API calls are not necessary.",
				Defer: {
					start: 0,
					end: 30000
				},
				Code: async () => {
					let counter = 0;
					const promises = [];
					const batchSize = 100;
					const channelList = sb.Channel.getJoinableForPlatform("twitch").filter(i => i.Specific_ID);

					while (counter < channelList.length) {
						const sliceString = channelList
							.slice(counter, counter + batchSize)
							.map(i => `user_id=${i.Specific_ID}`)
							.join("&");

						promises.push(
							sb.Got("Helix", {
								url: `streams?${sliceString}`,
								responseType: "json"
							})
						);

						counter += batchSize;
					}

					const streams = [];
					const results = await Promise.all(promises);
					for (const partialResult of results) {
						const streamsBlock = partialResult.body?.data ?? [];
						streams.push(...streamsBlock);
					}

					const channelPromises = channelList.map(async (channelData) => {
						const stream = streams.find(i => channelData.Specific_ID === String(i.user_id));
						const streamData = await channelData.getStreamData();

						if (!stream) {
							if (streamData.live === true) {
								channelData.events.emit("offline", {
									event: "offline",
									channel: channelData
								});
							}

							streamData.live = false;
							streamData.stream = {};
						}
						else {
							const currentStreamData = {
								game: stream.game_name,
								since: new sb.Date(stream.started_at),
								status: stream.title,
								viewers: stream.viewer_count
							};

							if (!streamData.live) {
								channelData.events.emit("online", {
									event: "online",
									stream: currentStreamData.stream,
									channel: channelData
								});
							}

							streamData.live = true;
							streamData.stream = currentStreamData;
						}

						await channelData.setStreamData(streamData);
					});

					await Promise.all(channelPromises);
				}
			})
		];

		// Disabled temporarily - different channel join behaviour
		// this.data.crons[0].start();
		if (this.platform.Data.trackChannelsLiveStatus) {
			// this.data.crons[1].start();
			this.data.crons[0].start();
		}
	}

	initListeners () {
		const client = this.client;

		client.on("error", async (error) => {
			if (error instanceof DankTwitch.JoinError && error.failedChannelName) {
				const channelData = sb.Channel.get(error.failedChannelName);
				if (!channelData) {
					return;
				}

				if (error.message.includes("suspended")) {
					// @todo Promise.all
					await channelData.setDataProperty("inactiveReason", "suspended");
					await channelData.saveProperty("Mode", "Inactive");

					await sb.Logger.log(
						"Twitch.Fail",
						`Channel ${channelData.Name} suspended - set to Inactive`,
						channelData,
						null
					);
				}
				else {
					const result = await this.executeChannelRename(channelData);

					if (result.reason === "channel-suspended") {
						await sb.Logger.log(
							"Twitch.Fail",
							`Channel ${channelData.Name} unavailable - set to Inactive`,
							channelData,
							null
						);
					}
					else if (result.reason === "channel-id-mismatch") {
						await sb.Logger.log(
							"Twitch.Warning",
							`Possible user rename has a mismatched user ID. Data dump: ${JSON.stringify(result)}`,
							channelData,
							null
						);
					}
					else if (result.action && result.action.includes("rename")) {
						const { login } = result;
						const suggestionIDs = await sb.Query.getRecordset(rs => rs
							.select("ID")
							.from("data", "Suggestion")
							.where("Category = %s", "Bot suggestion")
							.where("Status IS NULL")
							.where("Text %like", login)
							.flat("ID")
						);

						for (const ID of suggestionIDs) {
							const row = await sb.Query.getRow("data", "Suggestion");
							await row.load(ID);

							row.values.Status = "Completed";
							row.values.Notes = `Completed due to automatic rename detection\n\n${row.values.Notes}`;
							await row.save({ skipLoad: true });
						}
					}
				}
			}
			else if (error instanceof DankTwitch.SayError && error.cause instanceof DankTwitch.MessageError) {
				if (error.message.includes("Bad response message")) {
					const { messageText } = error;
					const channelData = sb.Channel.get(error.failedChannelName, this.platform);

					let defaultReply;
					if (/reminders? from/i.test(messageText)) {
						const recipient = messageText.match(/(.*), reminders? from/);
						if (recipient) {
							await this.pm(`Couldn't post reminder: ${messageText}`, recipient[1]);

							defaultReply = sb.Utils.tag.trim `
								@${recipient[1].replace(/^@/, "")},
								a reminder you would have received violated this channel's moderation settings.
								You can check your whispers, or head to https://supinic.com/bot/reminder/history 
							`;
						}
						else {
							defaultReply = "A reminder that was about to be posted violated this channel's moderation settings.";
						}
					}
					else {
						defaultReply = "A message that was about to be posted violated this channel's moderation settings.";
					}

					this.rejectedMessageTimeouts[channelData.ID] ??= 0;

					if (this.rejectedMessageTimeouts[channelData.ID] < sb.Date.now() && !messageText.includes(defaultReply)) {
						await this.send(defaultReply, channelData);

						const timeout = this.platform.Data.rejectedMessageTimeout ?? 10_000;
						this.rejectedMessageTimeouts[channelData.ID] = sb.Date.now() + timeout;
					}
				}
				else if (error.message.includes("has been suspended")) {
					console.warn("Attempting to send a message in banned channel", { error });
				}
				else if (error.message.startsWith("Failed to say")) {
					console.debug("Failed to say message", { error });
				}
				else {
					console.debug("Unknown Say/MessageError", { error });
				}
			}
		});

		client.on("JOIN", async (message) => {
			if (message.joinedUsername !== this.platform.Self_Name.toLowerCase()) {
				return;
			}

			const { channelName } = message;
			const channelData = sb.Channel.get(channelName);
			channelData.sessionData.joined = true;
			channelData.sessionData.parted = false;

			// @todo: Could this possibly be a part of channelData? So that it is platform-independent...
			const { channels, string } = this.platform.Data.reconnectAnnouncement;
			const sayPromises = [];
			if (channels && string && channels.includes(channelName)) {
				sayPromises.push(client.say(channelName, string));
			}

			await Promise.allSettled(sayPromises);
		});

		client.on("PART", (message) => {
			if (message.partedUsername !== this.platform.Self_Name.toLowerCase()) {
				return;
			}

			const channelData = sb.Channel.get(message.channelName);
			channelData.sessionData.joined = false;
			channelData.sessionData.parted = true;
		});

		client.on("USERSTATE", async (messageObject) => {
			const now = sb.Date.now();

			if (!this.platform.Data.updateAvailableBotEmotes) {
				return;
			}
			else if (this.recentEmoteFetchTimeout > now) {
				return;
			}

			const incomingEmoteSets = messageObject.emoteSets;
			if (this.availableEmotes.length === 0 || incomingEmoteSets.sort().join(",") !== this.availableEmoteSets.sort().join(",")) {
				this.availableEmoteSets = incomingEmoteSets;

				const timeout = this.platform.Data.emoteFetchTimeout ?? 10_000;
				this.recentEmoteFetchTimeout = now + timeout;

				let emotes;
				try {
					emotes = await TwitchController.fetchTwitchEmotes(this.availableEmoteSets);
				}
				catch {
					emotes = null;
				}

				if (emotes) {
					this.availableEmotes = emotes;
					await this.platform.invalidateGlobalEmotesCache();
				}
			}
		});

		client.on("NOTICE", async ({ channelName, messageID, ...rest }) => {
			if (!messageID) {
				return;
			}

			const channelData = sb.Channel.get(channelName, this.platform);
			switch (messageID) {
				case "msg_rejected":
				case "msg_rejected_mandatory": {
					const json = JSON.stringify({ channelName, messageID, rest });
					await sb.Logger.log(
						"Twitch.Warning",
						`Rejected message: ${json}`,
						channelData
					);

					break;
				}

				case "msg_banned": {
					if (channelData.Mode === "Inactive") {
						break;
					}

					const previousMode = channelData.Mode;
					await Promise.all([
						channelData.setDataProperty("inactiveReason", "bot-banned"),
						channelData.saveProperty("Mode", "Inactive"),
						await sb.Logger.log(
							"Twitch.Ban",
							`Bot banned in channel ${channelData.Name}. Previous mode: ${previousMode}`,
							channelData
						),
						this.client.part(channelData.Name)
					]);

					break;
				}

				case "no_permission": {
					channelData.send("I don't have permission to do that.");
					break;
				}

				case "host_on":
				case "host_off":
				case "host_target_went_offline": {
					// ignore these messages
					break;
				}
			}
		});

		client.on("PRIVMSG", async (message) => await this.handleMessage(message));

		client.on("WHISPER", (message) => this.handleMessage(message));

		client.on("USERNOTICE", (message) => this.handleUserNotice(message));

		client.on("CLEARCHAT", (messageObject) => {
			const { targetUsername: username, channelName, reason = null } = messageObject;

			if (messageObject.isPermaban()) {
				this.handleBan(username, channelName, reason, null);
			}
			else if (messageObject.isTimeout()) {
				this.handleBan(username, channelName, reason, messageObject.banDuration);
			}
			else if (messageObject.wasChatCleared() && this.platform.Logging.clearChats) {
				const channelData = sb.Channel.get(channelName, this.platform);
				sb.Logger.log("Twitch.Clearchat", null, channelData);
			}
		});
	}

	/**
	 * Sends a message, respecting each channel's current setup and limits
	 * @param {string} message
	 * @param {Channel|string} channel
	 */
	async send (message, channel) {
		if (typeof message !== "string") {
			throw new sb.Error({
				message: "Provided Twitch message is not a string",
				args: {
					channel,
					message: {
						type: typeof message,
						constructor: message?.constructor?.name ?? "N/A"
					}
				}
			});
		}

		const channelData = sb.Channel.get(channel, this.platform);
		const joinOverride = this.platform?.Data.joinChannelsOverride ?? [];
		if (this.platform.Data.suspended || joinOverride.length !== 0 && !joinOverride.includes(channelData.ID)) {
			return;
		}

		const channelName = channelData.Name;
		message = message.replace(/\s+/g, " ").trim();

		if (channelData.Mode === "Inactive" || channelData.Mode === "Read" || channelData.Mode === "Last seen") {
			return;
		}

		// Create a message scheduler for the channel if there is none
		// OR if the queue mode does not match the current channel mode
		if (typeof this.queues[channelName] === "undefined" || this.queues[channelName].mode !== channelData.Mode) {
			if (this.queues[channelName]) {
				this.queues[channelName].destroy();
				this.queues[channelName] = null;
			}

			const { modes } = this.platform.Data;
			const scheduler = new MessageScheduler({
				mode: channelData.Mode,
				channelID: channelData.ID,
				timeout: modes[channelData.Mode].cooldown,
				maxSize: modes[channelData.Mode].queueSize
			});

			const channelID = channelData.ID;
			scheduler.on("message", async (msg) => {
				try {
					await this.client.say(channelName, msg);
				}
				catch (e) {
					await sb.Logger.log("Twitch.Warning", String(e), { ID: channelID }, null);
				}
			});

			this.queues[channelName] = scheduler;
		}

		// Check if the bot is about the send an identical message to the last one
		if (this.evasion[channelName] === message) {
			const { sameMessageEvasionCharacter: char } = this.platform.Data;
			if (message.includes(char)) {
				const regex = new RegExp(`${char}$`);
				message = message.replace(regex, "");
			}
			else {
				message += ` ${char}`;
			}
		}

		this.evasion[channelName] = message;
		this.queues[channelName].schedule(message);
	}

	/**
	 * Sends a private message to given user.
	 * @param {string} message
	 * @param {string} user
	 */
	async pm (message, user) {
		const userData = await sb.User.get(user);
		const trimmedMessage = message.replace(/[\r\n]/g, " ").trim();

		const joinOverride = this.platform?.Data.joinChannelsOverride ?? [];
		if (this.platform.Data.suspended || joinOverride.length !== 0) {
			return;
		}

		try {
			await this.client.whisper(userData.Name, trimmedMessage);
		}
		catch (e) {
			await sb.Logger.log("Twitch.Warning", String(e), null, null);
		}
	}

	/**
	 * Handles incoming messages.
	 * @param {DankTwitch.PrivmsgMessage|DankTwitch.WhisperMessage} messageObject
	 * @returns {Promise<void>}
	 */
	async handleMessage (messageObject) {
		const { ircTags, badges, bits, channelName, messageText: message, senderUserID, senderUsername } = messageObject;
		const messageType = (messageObject instanceof DankTwitch.WhisperMessage)
			? "whisper"
			: "message";

		let channelData = null;
		let userState = {};
		if (messageType === "message") {
			userState = messageObject.extractUserState();
		}

		const messageData = {
			bits,
			userBadges: userState.badges,
			userBadgeInfo: userState.badgeInfo,
			color: userState.color,
			colorRaw: userState.colorRaw,
			privateMessage: (messageType === "whisper"),
			messageID: ircTags.id,
			emotes: ircTags.emotes,
			flags: ircTags.flags,
			customRewardID: ircTags["custom-reward-id"] ?? null
		};

		const userData = await sb.User.get(senderUsername, false, { Twitch_ID: senderUserID });
		if (!userData) {
			if (messageType === "whisper") {
				return;
			}

			const channelData = sb.Channel.get(channelName, this.platform);
			if (channelData) {
				channelData.events.emit("message", {
					event: "message",
					message,
					user: null,
					channel: channelData,
					platform: this.platform,
					raw: {
						user: senderUsername
					},
					messageData
				});
			}

			return;
		}
		else if (userData.Twitch_ID === null && userData.Discord_ID !== null) {
			if (!this.platform.Data.sendVerificationChallenge) {
				// No verification challenge - just assume it's correct
				if (this.data.updatingUserIDPromises < 10) {
					this.data.updatingUserIDPromises++;
					await userData.saveProperty("Twitch_ID", senderUserID);
					this.data.updatingUserIDPromise--;
				}
			}
			else {
				if (!message.startsWith(sb.Command.prefix)) {
					return;
				}

				const status = await TwitchController.fetchAccountChallengeStatus(userData, senderUserID);
				if (status === "Active") {
					return;
				}

				const { challenge } = await TwitchController.createAccountChallenge(userData, senderUserID);
				const message = sb.Utils.tag.trim `
					You were found to be likely to own a Discord account with the same name as your current Twitch account.
					If you want to use my commands on Twitch, whisper me the following command on Discord:
					${sb.Command.prefix}link ${challenge}
				 `;

				await this.pm(userData.Name, message);
				return;
			}
		}
		else if (userData.Twitch_ID === null && userData.Discord_ID === null) {
			if (this.data.updatingUserIDPromises < 10) {
				this.data.updatingUserIDPromises++;
				await userData.saveProperty("Twitch_ID", senderUserID);
				this.data.updatingUserIDPromise--;
			}
			else {
				// try again later
			}
		}
		else if (userData.Twitch_ID !== senderUserID) {
			// Mismatch between senderUserID and userData.Twitch_ID means someone renamed into a different
			// user's username, or that there is a different mishap happening. This case is unfortunately exceptional
			// for the current user-database structure and the event handler must be aborted.
			const channelData = (channelName)
				? sb.Channel.get(channelName, this.platform)
				: null;

			if (!channelName || (channelData && sb.Command.is(message))) {
				const notified = await userData.getDataProperty("twitch-userid-mismatch-notification");
				if (!notified) {
					const message = sb.Utils.tag.trim `
						@${userData.Name}, you have been flagged as suspicious.
						This is because I have seen your Twitch username on a different account before.
						This is usually caused by renaming into an account that existed before.
						To remedy this, head into Supinic's channel chat twitch.tv/supinic and mention this.												
					`;

					if (channelData) {
						const finalMessage = await this.prepareMessage(message, channelData);
						if (!finalMessage) {
							await this.pm(message, userData.Name);
						}
						else {
							await channelData.send(finalMessage);
						}
					}
					else {
						await this.pm(message, userData.Name);
					}

					await Promise.all([
						sb.Logger.log(
							"Twitch.Other",
							`Suspicious user: ${userData.Name} - ${userData.Twitch_ID}`,
							null,
							userData
						),
						userData.setDataProperty("twitch-userid-mismatch-notification", true)
					]);
				}
			}

			return;
		}

		// Only check channels,
		if (messageType !== "whisper") {
			channelData = sb.Channel.get(channelName, this.platform);

			if (!channelData) {
				console.error(`Cannot find channel ${channelName}`);
				return;
			}

			channelData.sessionData.lastActivity = {
				user: userData.ID,
				date: new sb.Date().valueOf()
			};

			this.resolveUserMessage(channelData, userData, message);

			if (channelData.Mode === "Last seen") {
				await sb.Logger.updateLastSeen({ userData, channelData, message });
				return;
			}
			else if (channelData.Mode === "Inactive") {
				return;
			}

			if (this.platform.Logging.messages) {
				await sb.Logger.push(message, userData, channelData);
			}

			channelData.events.emit("message", {
				event: "message",
				message,
				user: userData,
				channel: channelData,
				platform: this.platform,
				data: messageData
			});

			// If channel is read-only, do not proceed with any processing
			// Such as un-AFK message, reminders, commands, ...
			if (channelData.Mode === "Read") {
				return;
			}

			await Promise.all([
				sb.AwayFromKeyboard.checkActive(userData, channelData),
				sb.Reminder.checkActive(userData, channelData)
			]);

			// Mirror messages to a linked channel, if the channel has one
			if (channelData.Mirror) {
				this.mirror(message, userData, channelData, { commandUsed: false });
			}
		}
		else {
			if (this.platform.Logging.whispers) {
				await sb.Logger.push(message, userData, null, this.platform);
			}

			this.resolveUserMessage(null, userData, message);
		}

		// Own message - check the regular/vip/mod/broadcaster status, and skip
		if (userData.Name === this.platform.Self_Name && channelData) {
			if (badges) {
				const oldMode = channelData.Mode;

				if (badges.hasModerator || badges.hasBroadcaster) {
					channelData.Mode = "Moderator";
				}
				else if (badges.hasVIP) {
					channelData.Mode = "VIP";
				}
				else {
					channelData.Mode = "Write";
				}

				if (oldMode !== channelData.Mode) {
					const row = await sb.Query.getRow("chat_data", "Channel");
					await row.load(channelData.ID);
					row.values.Mode = channelData.Mode;
					await row.save();
				}
			}

			return;
		}

		if (this.platform.Logging.bits && typeof bits !== "undefined" && bits !== null) {
			sb.Logger.log("Twitch.Other", `${bits} bits`, channelData, userData);
		}

		if (!sb.Command.prefix) {
			return;
		}

		// Check and execute command if necessary
		if (sb.Command.is(message)) {
			const now = sb.Date.now();
			const timeout = this.userCommandSpamPrevention.get(userData.ID);
			if (typeof timeout === "number" && timeout > now) {
				return;
			}

			const threshold = this.platform.Data.spamPreventionThreshold ?? 100;
			this.userCommandSpamPrevention.set(userData.ID, now + threshold);

			const [command, ...args] = message
				.replace(sb.Command.prefix, "")
				.split(/\s+/)
				.filter(Boolean);

			const result = await this.handleCommand(
				command,
				userData,
				channelData,
				args,
				messageData
			);

			if ((!result || !result.success) && messageType === "whisper") {
				if (!result?.reply && result?.reason === "filter") {
					await this.pm(sb.Config.get("PRIVATE_MESSAGE_COMMAND_FILTERED"), userData.Name);
				}
				else if (result?.reason === "no-command") {
					await this.pm(sb.Config.get("PRIVATE_MESSAGE_NO_COMMAND"), userData.Name);
				}
			}
		}
		else if (messageType === "whisper") {
			await this.pm(sb.Config.get("PRIVATE_MESSAGE_UNRELATED"), userData.Name);
		}
	}

	/**
	 * Handles a command being used.
	 * @param {string} command
	 * @param {string} user
	 * @param {string} channel
	 * @param {string[]} [args]
	 * @param {Object} options = {}
	 * @returns {Promise<boolean>} Whether or not a command has been executed.
	 */
	async handleCommand (command, user, channel, args = [], options = {}) {
		const userData = await sb.User.get(user, false);
		const channelData = (channel === null) ? null : sb.Channel.get(channel, this.platform);
		const execution = await sb.Command.checkAndExecute(command, args, channelData, userData, {
			platform: this.platform,
			...options
		});

		if (!execution || !execution.reply) {
			return execution;
		}

		const commandOptions = sb.Command.extractMetaResultProperties(execution);
		if (options.privateMessage || execution.replyWithPrivateMessage) {
			const message = await this.prepareMessage(execution.reply, null, {
				...commandOptions,
				extraLength: (`/w ${userData.Name} `).length,
				skipBanphrases: true
			});

			await this.pm(message, userData.Name);
		}
		else {
			if (channelData?.Mirror) {
				await this.mirror(execution.reply, userData, channelData, {
					...commandOptions,
					commandUsed: true
				});
			}

			const message = await this.prepareMessage(execution.reply, channelData, {
				...commandOptions,
				skipBanphrases: true
			});

			if (message) {
				await this.send(message, channelData);
			}
		}

		return execution;
	}

	/**
	 * Reacts to user timeouts and bans alike
	 * @param {string} user
	 * @param {string} channel
	 * @param {string|null} reason=null
	 * @param {number|null} length=null
	 * @returns {Promise<void>}
	 */
	async handleBan (user, channel, reason = null, length = null) {
		const channelData = sb.Channel.get(channel, this.platform);
		if (channelData) {
			if (user === this.platform.Self_Name && length === null && this.platform.Data.partChannelsOnPermaban) {
				const previousMode = channelData.Mode;
				await Promise.all([
					channelData.setDataProperty("inactiveReason", "bot-banned"),
					channelData.saveProperty("Mode", "Inactive"),
					sb.Logger.log(
						"Twitch.Ban",
						`Bot banned in channel ${channelData.Name}. Previous mode: ${previousMode}`,
						channelData
					)
				]);
			}

			if (typeof channelData.sessionData.recentBans === "undefined") {
				channelData.sessionData.recentBans = 0;
			}

			const limit = this.platform.Data.recentBanThreshold ?? Infinity;
			if (!channelData.sessionData.parted && channelData.sessionData.recentBans > limit) {
				channelData.sessionData.parted = true;

				setTimeout(() => {
					if (!channelData?.sessionData) {
						return;
					}

					console.debug(`Re-joining channel ${channelData.Name}!`);
					channelData.sessionData.parted = false;
					this.client.join(channelData.Name);
				}, this.platform.Data.recentBanPartTimeout);

				await this.client.part(channelData.Name);
			}

			if (!channelData.sessionData.clearRecentBansTimeout) {
				channelData.sessionData.clearRecentBansTimeout = setTimeout(
					() => {
						if (!channelData?.sessionData) {
							return;
						}

						channelData.sessionData.recentBans = 0;
						channelData.sessionData.clearRecentBansTimeout = null;
					},
					this.platform.Data.clearRecentBansTimer
				);
			}

			channelData.sessionData.recentBans++;

			if (
				(length === null && this.platform.Logging.bans)
				|| (length !== null && this.platform.Logging.timeouts)
			) {
				sb.Logger.logBan(user, channelData, length, new sb.Date(), reason);
			}
		}
	}

	async handleUserNotice (messageObject) {
		const { messageText, messageTypeID, senderUsername, channelName } = messageObject;

		// ignore these events
		if (this.platform.Data.ignoredUserNotices.includes(messageTypeID)) {
			return;
		}

		const userData = await sb.User.get(senderUsername);
		const channelData = sb.Channel.get(channelName, this.platform);
		if (!channelData) {
			return;
		}

		const eventSkipModes = ["Read", "Last seen", "Inactive"];
		const logSkipModes = ["Inactive", "Last seen"];
		const plans = this.platform.Data.subscriptionPlans;

		if (messageObject.isSub() || messageObject.isResub()) {
			const { cumulativeMonths, streakMonths, subPlanName } = messageObject.eventParams;
			if (!eventSkipModes.includes(channelData.Mode)) {
				channelData.events.emit("subscription", {
					event: "subscription",
					message: messageText,
					user: userData,
					channel: channelData,
					platform: this.platform,
					data: {
						amount: 1,
						gifted: false,
						recipient: userData,
						months: cumulativeMonths,
						streak: streakMonths ?? 1,
						plan: plans[subPlanName]
					}
				});
			}

			if (this.platform.Logging.subs && !logSkipModes.includes(channelData.Mode)) {
				await sb.Logger.log("Twitch.Sub", plans[subPlanName], channelData, userData);
			}
		}
		else if (messageObject.messageID === "anonsubgift" || messageObject.isSubgift()) {
			const {
				cumulativeMonths,
				recipientUsername,
				streakMonths,
				subPlanName
			} = messageObject.eventParams;

			const recipientData = await sb.User.get(recipientUsername);
			if (!recipientData) {
				return;
			}

			if (!eventSkipModes.includes(channelData.Mode)) {
				channelData.events.emit("subscription", {
					event: "subscription",
					message: messageText,
					user: userData,
					channel: channelData,
					platform: this.platform,
					data: {
						amount: 1,
						gifted: true,
						recipient: recipientData,
						months: cumulativeMonths,
						streak: streakMonths ?? 1,
						plan: plans[subPlanName]
					}
				});
			}

			if (this.platform.Logging.giftSubs && !logSkipModes.includes(channelData.Mode)) {
				const name = userData?.Name ?? "(anonymous)";
				const logMessage = `${name} gifted a subscription to ${recipientData.Name}`;

				sb.Logger.log("Twitch.Giftsub", logMessage, channelData, userData);
			}
		}
		else if (messageObject.isRaid()) {
			const viewers = Number(messageObject.eventParams.viewercount);
			if (!eventSkipModes.includes(channelData.Mode)) {
				channelData.events.emit("raid", {
					event: "raid",
					message: messageText ?? null,
					channel: channelData,
					user: userData,
					platform: this.platform,
					data: {
						viewers
					}
				});
			}

			if (this.platform.Logging.hosts && !logSkipModes.includes(channelData.Mode)) {
				sb.Logger.log("Twitch.Host", `Raid: ${userData?.Name ?? null} => ${channelData.Name} for ${viewers} viewers`);
			}
		}
		else if (messageObject.isRitual()) {
			if (this.platform.Logging.rituals && !logSkipModes.includes(channelData.Mode)) {
				const userData = await sb.User.get(senderUsername, false);
				const channelData = sb.Channel.get(channelName, this.platform);

				sb.Logger.log("Twitch.Ritual", `${messageObject.systemMessage} ${messageText}`, channelData, userData);
			}
		}
		else {
			console.warn("Uncaught USERNOTICE event", messageObject);
		}
	}

	/**
	 * Determines if a user is an owner of a given channel.
	 * @param {Channel} channelData
	 * @param {User} userData
	 * @returns {boolean}
	 */
	async isUserChannelOwner (channelData, userData) {
		if (userData === null || channelData === null) {
			return false;
		}

		return (channelData.Specific_ID === userData.Twitch_ID);
	}

	async getUserID (user) {
		let userData = await sb.User.get(user, true);
		if (userData?.Twitch_ID) {
			return userData.Twitch_ID;
		}

		const channelInfo = await sb.Got("Helix", {
			url: "users",
			throwHttpErrors: false,
			searchParams: new sb.URLParams()
				.set("login", user)
				.toString()
		}).json();

		if (!channelInfo.error && channelInfo.data.length !== 0) {
			const { id, display_name: name } = channelInfo.data[0];
			if (!userData) {
				userData = await sb.User.get(name, false);
			}
			if (userData) {
				await userData.saveProperty("Twitch_ID", id);
			}

			return id;
		}

		return null;
	}

	async fetchUserList (channelIdentifier) {
		const { statusCode, body: data } = await sb.Got("GenericAPI", {
			url: `https://tmi.twitch.tv/group/user/${channelIdentifier}/chatters`,
			responseType: "json",
			throwHttpErrors: false
		});

		if (statusCode !== 200) {
			return [];
		}

		return Object.values(data.chatters).flat();
	}

	async prepareMessage (message, channel, options) {
		let preparedMessage = await super.prepareMessage(message, channel, options);

		if (channel === null) {
			const limit = this.platform.Message_Limit - options.extraLength;
			preparedMessage = sb.Utils.wrapString(preparedMessage, limit);
		}

		return preparedMessage;
	}

	async createUserMention (userData) {
		return `@${userData.Name}`;
	}

	/**
	 * Fetches a list of emote data for a given list of emote sets.
	 * @param {string[]} inputSets
	 * @returns {Promise<TwitchEmoteSetDataObject[]>}
	 */
	static async fetchTwitchEmotes (inputSets) {
		const data = [];
		const sliceLength = 100;
		let index = 0;

		// Replace "special" emote sets that are not available with their "original" id with the one that is
		// actually available in the emote set list
		const sets = inputSets.map(i => specialEmoteSetMap[i] ?? i);

		while (index < sets.length) {
			const slice = sets.slice(index, index + sliceLength);
			const { statusCode, body } = await sb.Got("Leppunen", {
				url: "v2/twitch/emotes/sets",
				searchParams: {
					set_id: slice.join(",")
				}
			});

			if (statusCode !== 200) {
				await sb.Logger.log("Twitch.Warning", JSON.stringify({
					message: "Fetching Twitch emotes failed",
					statusCode,
					body,
					slice,
					sets
				}));

				return [];
			}

			index += sliceLength;
			data.push(...body);
		}

		return data.map(set => ({
			ID: set.setID,
			channel: {
				name: set.channelName,
				login: set.channelLogin,
				ID: set.channelID
			},
			tier: set.tier,
			emotes: (set.emoteList ?? []).map(i => ({
				ID: i.id,
				token: i.code,
				animated: (i.assetType === "ANIMATED")
			}))
		}));
	}

	/**
	 * Fetches a list of BTTV emote data for a given channel
	 * @param {Channel} channelData
	 * @returns {Promise<TypedEmote[]>}
	 */
	static async fetchChannelBTTVEmotes (channelData) {
		const channelID = channelData.Specific_ID ?? await channelData.platform.controller.getUserID(channelData.Name);
		if (!channelID) {
			throw new sb.Error({
				message: "No available ID for channel",
				args: { channel: channelData.Name }
			});
		}

		const { statusCode, body: data } = await emoteGot({
			url: `https://api.betterttv.net/3/cached/users/twitch/${channelID}`
		});

		if (statusCode !== 200) {
			if (statusCode !== 404) {
				await sb.Logger.log("Twitch.Warning", `BTTV emote fetch failed, code: ${statusCode}`, channelData);
			}

			return [];
		}

		const emotes = [
			...(data.channelEmotes ?? []),
			...(data.sharedEmotes ?? [])
		];

		return emotes.map(i => ({
			ID: i.id,
			name: i.code,
			type: "bttv",
			global: false,
			animated: (i.imageType === "gif")
		}));
	}

	/**
	 * Fetches a list of FFZ emote data for a given channel
	 * @param {Channel} channelData
	 * @returns {Promise<TypedEmote[]>}
	 */
	static async fetchChannelFFZEmotes (channelData) {
		const { statusCode, body: data } = await emoteGot({
			url: `https://api.frankerfacez.com/v1/room/${channelData.Name}`
		});

		if (statusCode !== 200) {
			if (statusCode !== 404) {
				await sb.Logger.log("Twitch.Warning", `FFZ emote fetch failed, code: ${statusCode}`, channelData);
			}

			return [];
		}

		const emotes = Object.values(data.sets).flatMap(i => i.emoticons);
		return emotes.map(i => ({
			ID: i.id,
			name: i.name,
			type: "ffz",
			global: false,
			animated: false
		}));
	}

	/**
	 * Fetches a list of 7TV emote data for a given channel
	 * @param {Channel} channelData
	 * @returns {Promise<TypedEmote[]>}
	 */
	static async fetchChannelSevenTVEmotes (channelData) {
		const { statusCode, body: data } = await emoteGot({
			url: `https://api.7tv.app/v2/users/${channelData.Name}/emotes`
		});

		if (statusCode !== 200) {
			if (statusCode !== 404) {
				await sb.Logger.log("Twitch.Warning", `7TV emote fetch failed, code: ${statusCode}`, channelData);
			}

			return [];
		}

		return data.map(i => ({
			ID: i.id,
			name: i.name,
			type: "7tv",
			global: false,
			animated: (typeof i.animated === "boolean") ? i.animated : null
		}));
	}

	/**
	 * Fetches all global emotes for any context.
	 * Ideally cached for a rather long time.
	 * @returns {Promise<TypedEmote[]>}
	 */
	async fetchGlobalEmotes () {
		const [bttv, ffz, sevenTv] = await Promise.allSettled([
			emoteGot({
				url: "https://api.betterttv.net/3/cached/emotes/global"
			}),
			emoteGot({
				url: "https://api.frankerfacez.com/v1/set/global"
			}),
			emoteGot({
				url: "https://api.7tv.app/v2/emotes/global"
			})
		]);

		const rawFFZEmotes = Object.values(ffz.value?.body.sets ?? {});
		const rawBTTVEmotes = (bttv.value?.body && typeof bttv.value?.body === "object")
			? Object.values(bttv.value.body)
			: [];
		const rawSevenTvEmotes = (sevenTv.value?.body && typeof sevenTv.value?.body === "object")
			? Object.values(sevenTv.value.body)
			: [];

		return [
			...this.availableEmotes
				.flatMap(set => set.emotes.map(i => ({
					ID: i.ID,
					name: i.token,
					// Massive hackfuck-workaround - animated emotes are present in their own emoteset without a tier,
					// hence a special check must be added here. Otherwise, they will be considered as global.
					type: (i.animated || set.tier === "1" || set.tier === "2" || set.tier === "3")
						? "twitch-subscriber"
						: "twitch-global",
					global: true,
					animated: i.animated
				}))),

			...rawFFZEmotes.flatMap(i => i.emoticons).map(i => ({
				ID: i.id,
				name: i.name,
				type: "ffz",
				global: true ,
				animated: false
			})),

			...rawBTTVEmotes.map(i => ({
				ID: i.id,
				name: i.code,
				type: "bttv",
				global: true,
				animated: (i.imageType === "gif")
			})),

			...rawSevenTvEmotes.map(i => ({
				ID: i.id,
				name: i.name,
				type: "7tv",
				global: true,
				// Just hoping that .gif emotes are always animated.
				// @todo proper animated emote checking with new 7TV API (?)
				animated: (i.mime === "image/gif")
			}))
		];
	}

	/**
	 * @param {Channel} channelData
	 * @returns {Promise<TypedEmote[]>}
	 */
	async fetchChannelEmotes (channelData) {
		const [bttv, ffz, sevenTv] = await Promise.allSettled([
			TwitchController.fetchChannelBTTVEmotes(channelData),
			TwitchController.fetchChannelFFZEmotes(channelData),
			TwitchController.fetchChannelSevenTVEmotes(channelData)
		]);

		return [
			...(bttv.value ?? []),
			...(ffz.value ?? []),
			...(sevenTv.value ?? [])
		];
	}

	/**
	 * @param {string} channel ChannelLike
	 * @returns {Promise<{
	 *  success: boolean,
	 *  reason?: "no-channel" | "no-channel-exists" | "channel-suspended" | "no-rename" | "channel-id-mismatch" | "no-action",
	 *  action?: "rename" | "repeat-rename",
	 *  channel?: number
	 *  data?: {
	 *      id: string,
	 *      login: string,
	 *      joinFailed?: boolean,
	 *      newChannel?: string
	 *  }>}}
	 */
	async executeChannelRename (channel) {
		const channelData = sb.Channel.get(channel);
		if (!channelData) {
			return {
				success: false,
				reason: "no-channel"
			};
		}

		const userID = await this.getUserID(channelData.Name);
		const response = await sb.Got("Helix", {
			url: "users",
			searchParams: {
				id: userID
			}
		});

		if (response.statusCode !== 200) {
			return {
				success: false,
				reason: "no-channel-exists",
				channel: channelData.ID
			};
		}
		else if (response.body.data.length === 0) {
			await channelData.setDataProperty("inactiveReason", "suspended");
			await channelData.saveProperty("Mode", "Inactive");

			return {
				success: false,
				reason: "channel-suspended",
				channel: channelData.ID
			};
		}

		const { id, login } = response.body.data[0];
		if (login === channelData.Name) {
			return {
				success: false,
				reason: "no-rename",
				channel: channelData.ID,
				data: { id, login }
			};
		}
		else if (id !== channelData.Specific_ID) {
			return {
				success: false,
				reason: "channel-id-mismatch",
				channel: channelData.ID,
				data: { id, login }
			};
		}

		const previousMode = channelData.Mode;
		await channelData.setDataProperty("inactiveReason", "renameed");
		await channelData.saveProperty("Mode", "Inactive");

		const otherChannelData = sb.Channel.get(login);
		if (!otherChannelData) {
			let joinFailed = false;
			const joinedChannel = await sb.Channel.add(login, this.platform, previousMode, channelData.Specific_ID);
			try {
				await this.client.join(login);
			}
			catch {
				joinFailed = true;
			}

			await sb.Channel.moveData(channelData, joinedChannel, {
				deleteOriginalValues: true,
				skipProperties: ["inactiveReason"]
			});

			return {
				success: true,
				action: "rename",
				data: {
					id,
					newChannel: joinedChannel.ID,
					joinFailed,
					login
				}
			};
		}
		else if (otherChannelData && otherChannelData.Mode === "Inactive") {
			let joinFailed = false;
			await otherChannelData.saveProperty("Mode", "Write");
			try {
				await this.client.join(login);
			}
			catch {
				joinFailed = true;
			}

			await sb.Channel.moveData(channelData, otherChannelData, {
				deleteOriginalValues: true,
				skipProperties: ["inactiveReason"]
			});

			return {
				success: true,
				action: "repeat-rename",
				data: { id, joinFailed, login }
			};
		}

		return {
			success: false,
			reason: "no-action",
			data: { id, login }
		};
	}

	static async fetchAccountChallengeStatus (userData, twitchID) {
		return await sb.Query.getRecordset(rs => rs
			.select("Status")
			.from("chat_data", "User_Verification_Challenge")
			.where("User_Alias = %n", userData.ID)
			.where("Specific_ID = %s", twitchID)
			.orderBy("ID DESC")
			.limit(1)
			.single()
			.flat("Status")
		);
	}

	static async createAccountChallenge (userData, twitchID) {
		const row = await sb.Query.getRow("chat_data", "User_Verification_Challenge");
		const challenge = require("crypto").randomBytes(16).toString("hex");

		row.setValues({
			User_Alias: userData.ID,
			Specific_ID: twitchID,
			Challenge: challenge,
			Platform_From: sb.Platform.get("twitch").ID,
			Platform_To: sb.Platform.get("discord").ID
		});

		await row.save();
		return {
			challenge
		};
	}

	destroy () {
		this.client.removeAllListeners();
		this.client.disconnect();
		this.client = null;
	}
};

/**
 * @typedef {Object} TwitchEmoteSetDataObject Describes a Twitch emote set.
 * @property {string} setID
 * @property {Object} channel
 * @property {string} channel.name Channel display name
 * @property {string} channel.login Channel login name (as it appears e.g. in URLs)
 * @property {string} channel.ID Internal Twitch channel ID
 * @property {"1"|"2"|"3"|"Custom"|null} tier Determines the subscription tier of an emote
 * @property {EmoteDataObject[]} emotes List of emotes
 */

/**
 * @typedef {Object} EmoteDataObject
 * @property {string} ID Internal Twitch emote ID
 * @property {string} token Emote name
 */
