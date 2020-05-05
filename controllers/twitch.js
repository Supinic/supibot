/* global sb */

const MessageScheduler = require("message-scheduler");
const DankTwitch = require("dank-twitch-irc");

module.exports = class Twitch extends require("./template.js") {
	constructor () {
		super();

		this.platform = sb.Platform.get("twitch");
		if (!this.platform) {
			throw new sb.Error({
				message: "Twitch platform has not been created"
			});
		}
		else if (!sb.Config.has("TWITCH_OAUTH", true)) {
			throw new sb.Error({
				message: "Twitch oauth token (Config/TWITCH_OAUTH) has not been configured"
			});
		}
		else if (!sb.Config.has("TWITCH_CLIENT_ID", true)) {
			throw new sb.Error({
				message: "Twitch client id (Config/TWITCH_CLIENT_ID) has not been configured"
			});
		}

		this.client = new DankTwitch.ChatClient({
			username: this.platform.Self_Name,
			password: sb.Config.get("TWITCH_OAUTH"),
			rateLimits: this.platform.Data.rateLimits ?? "default"
		});

		this.queues = {};
		this.evasion = {};
		this.userIDTimeout = 0;
		this.failedJoinChannels = new Set();

		this.initListeners();

		this.client.connect();
		this.client.joinAll(sb.Channel.getJoinableForPlatform(this.platform).map(i => i.Name));
	}

	initListeners () {
		const client = this.client;

		client.on("error", error => {
			if (error instanceof DankTwitch.JoinError && error.failedChannelName) {
				this.failedJoinChannels.add(error.failedChannelName);
			}
			else if (error.cause instanceof DankTwitch.SayError && error.message.includes("2000")) {
				console.debug(error.message);
			}
		});

		client.on("JOIN", ({ channelName, joinedUsername }) => {
			// @todo: Could this possibly be a part of channelData? So that it is platform-independent...
			if (this.platform.Data.reconnectAnnouncement && joinedUsername === this.platform.Self_Name.toLowerCase()) {
				const { channels, string } = this.platform.Data.reconnectAnnouncement;
				if (channels.includes(channelName)) {
					client.say(channelName, string);
				}
			}
		});

		client.on("USERSTATE", async (messageObject) => {
			const { emoteSets } = messageObject;
			const strings = [
				emoteSets.sort().join(","),
				(this.availableEmoteSets)
					? this.availableEmoteSets.sort().join(",")
					: null
			];

			if (strings[0] !== strings[1]) {
				this.availableEmoteSets = emoteSets;

				// Reference: https://github.com/twitchdev/issues/issues/50
				// The emote set "0" breaks the following API call, therefore it has to be removed in order for at least
				// some emotes to be loaded. The global emotes are then fetched from TwitchEmotes API...
				const safeEmoteSets = emoteSets.slice(0);
				const breakingEmoteSetIndex = emoteSets.findIndex(i => i === "0");
				safeEmoteSets.splice(breakingEmoteSetIndex, 1);

				const [emoteData, globalEmoteData] = await Promise.all([
					sb.Got.instances.Twitch.Kraken({
						url: "chat/emoticon_images",
						searchParams: "emotesets=" + safeEmoteSets.join(",")
					}),
					sb.Got({
						url: "https://api.twitchemotes.com/api/v4/channels/0"
					}).json()
				]);

				this.availableEmotes = {
					0: globalEmoteData.emotes.map(i => ({ code: i.code, id: i.id })),
					...emoteData.emoticon_sets,
				};
			}
		});

		client.on("NOTICE", ({channelName, messageID, ...rest}) => {
			if (!messageID) {
				return;
			}

			const channelData = sb.Channel.get(channelName);
			switch (messageID) {
				case "msg_rejected":
				case "msg_rejected_mandatory": {
					sb.Master.send("That message violates this channel's moderation settings.", channelData);
					break;
				}

				case "no_permission": {
					sb.Master.send("I don't have permission to do that FeelsBadMan", channelData);
					break;
				}

				case "host_on":
				case "host_target_went_offline": {
					// ignore these messages
					break;
				}

				default:
					console.debug("incoming notice:", channelData.Name, messageID, rest);
			}
		});

		client.on("PRIVMSG", (message) => this.handleMessage(message));

		client.on("WHISPER", (message) => this.handleMessage(message));

		client.on("USERNOTICE", async (messageObject) => {
			const {messageText, messageTypeID, senderUsername, channelName} = messageObject;
			if (this.platform.Data.ignoredUserNotices.includes?.(messageTypeID)) {
				return; // ignore these events
			}

			if (messageObject.isSub() || messageObject.isResub()) {
				this.handleSubscription(
					senderUsername,
					channelName,
					messageObject.eventParams.subPlanName,
					messageText,
					{
						total: messageObject.eventParams.cumulativeMonths,
						streak: messageObject.eventParams.streakMonths || 1
					}
				);
			}
			else if (messageObject.messageID === "anonsubgift" || messageObject.isSubgift()) {
				const { months, recipientUserName } = messageObject.eventParams;
				const recipientData = await sb.User.get(recipientUserName);

				this.handleGiftedSubscription(channelName, senderUsername || null, {
					months,
					gifted: 1,
					recipient: recipientData
				});
			}
			else if (messageObject.isRaid()) {
				this.handleHost(
					"raid",
					channelName,
					senderUsername,
					messageObject.eventParams.viewerCount
				);
			}
			else if (messageObject.isRitual()) {
				const userData = await sb.User.get(senderUsername, false);
				const channelData = sb.Channel.get(channelName);

				if (this.platform.Logging.rituals) {
					sb.SystemLogger.send("Twitch.Ritual", messageObject.systemMessage + " " + messageText, channelData, userData);
				}
			}
			else {
				console.warn("Uncaught USERNOTICE event", messageObject);
			}
		});

		client.on("CLEARCHAT", (messageObject) => {
			const {targetUsername: username, channelName, reason = null} = messageObject;

			if (messageObject.isPermaban()) {
				this.handleBan(username, channelName, reason, null);
			}
			else if (messageObject.isTimeout()) {
				this.handleBan(username, channelName, reason, messageObject.banDuration);
			}
			else if (messageObject.wasChatCleared()) {
				if (this.platform.Logging.clearChats) {
					const channelData = sb.Channel.get(channelName);
					sb.SystemLogger.send("Twitch.Clearchat", null, channelData);
				}
			}
		});
	}

	/**
	 * Sends a message, respecting each channel's current setup and limits
	 * @param {string} message
	 * @param {Channel|string} channel
	 * @param {Object} [options]
	 */
	async send (message, channel, options = {}) {
		const channelData = sb.Channel.get(channel);
		const channelName = channelData.Name;
		if (channelData.Mode === "Inactive" || channelData.Mode === "Read") {
			return;
		}

		// Create a message scheduler for the channel if there is none
		// OR if the queue mode does not match the current channel mode
		if (typeof this.queues[channelName] === "undefined" || this.queues[channelName].mode !== channelData.Mode) {
			if (this.queues[channelName]) {
				this.queues[channelName].destroy();
				this.queues[channelName] = null;
			}

			const { defaultGlobalCooldown, defaultQueueSize, modes } = this.platform.Data;
			const scheduler = new MessageScheduler({
				mode: channelData.Mode,
				channelID: channelData.ID,
				timeout: modes?.[channelData.Mode]?.cooldown ?? defaultGlobalCooldown,
				maxSize: modes?.[channelData.Mode]?.queueSize ?? defaultQueueSize
			});

			scheduler.on("message", (msg) => {
				this.client.say(channelName, msg);
			});

			this.queues[channelName] = scheduler;
		}

		// Check if the bot is about the send an identical message to the last one
		if (this.evasion[channelName] === message) {
			const char = this.platform.Data.sameMessageEvasionCharacter;
			if (message.includes(char)) {
				const regex = new RegExp(char + "$");
				message = message.replace(regex, "");
			}
			else {
				message += " " + char;
			}
		}

		message = message.replace(/\s+/g, " ");

		this.evasion[channelName] = message;

		// sb.Logger.push(message, this.selfUserData, channelData);
		this.queues[channelName].schedule(message);
	}

	/**
	 * Sends a private message to given user.
	 * @param {string} user
	 * @param {string} message
	 */
	async pm (user, message) {
		const userData = await sb.User.get(user);
		this.client.whisper(userData.Name, message);
	}

	async handleMessage (messageObject) {
		const {ircTags, badges, bits, channelName, messageText: message, senderUserID, senderUsername} = messageObject;
		const messageType = (messageObject instanceof DankTwitch.WhisperMessage)
			? "whisper"
			: "message";

		let channelData = null;
		const userData = await sb.User.get(senderUsername, false, { Twitch_ID: senderUserID });
		if (!userData) {
			return;
		}

		// Only check channels,
		if (messageType !== "whisper") {
			channelData = sb.Channel.get(channelName);

			if (!channelData) {
				console.error("Cannot find channel " + channelName);
				return;
			}
			else if (channelData.Mode === "Last seen") {
				sb.Logger.updateLastSeen({ userData, channelData, message });
				return;
			}
			else if (channelData.Mode === "Inactive") {
				return;
			}

			if (this.platform.Logging.messages) {
				sb.Logger.push(message, userData, channelData);
			}

			// If channel is read-only, do not proceed with any processing
			// Such as custom codes, un-AFK, reminders, commands (...)
			if (channelData.Mode === "Read") {
				return;
			}

			if (channelData.Custom_Code) {
				channelData.Custom_Code({
					type: "message",
					message: message,
					user: userData,
					channel: channelData,
					bits: bits,
					customRewardID: ircTags["custom-reward-id"] ?? null
				});
			}

			const globalCustomCode = sb.Config.get("GLOBAL_CUSTOM_CHANNEL_CODE", false);
			if (globalCustomCode) {
				await globalCustomCode({
					type: "message",
					message: message,
					user: userData,
					channel: channelData
				});
			}

			sb.AwayFromKeyboard.checkActive(userData, channelData);
			sb.Reminder.checkActive(userData, channelData);

			// Mirror messages to a linked channel, if the channel has one
			if (channelData.Mirror) {
				this.mirror(message, userData, channelData);
			}
		}
		else {
			if (this.platform.Logging.whispers) {
				sb.SystemLogger.send("Twitch.Other", "whisper: " + message, null, userData);
			}

			console.debug("Whisper received: Twitch", userData.Name, message);
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
			sb.SystemLogger.send("Twitch.Other", bits + " bits", channelData, userData);
		}

		sb.Master.globalMessageListener(this.platform, channelData, userData, message);

		// Check and execute command if necessary
		if (message.startsWith(sb.Command.prefix)) {
			let userState = {};
			if (messageType === "message") {
				userState = messageObject.extractUserState();
			}

			const [command, ...args] = message.replace(sb.Command.prefix, "").split(" ").filter(Boolean);
			const result = await this.handleCommand(
				command,
				userData,
				channelData,
				args,
				{
					userBadges: userState.badges,
					userBadgeInfo: userState.badgeInfo,
					color: userState.color,
					colorRaw: userState.colorRaw,
					privateMessage: (messageType === "whisper"),
					messageID: ircTags.id,
					emotes: ircTags.emotes,
					customRewardID: ircTags["custom-reward-id"] ?? null
				}
			);

			if ((!result || !result.success) && messageType === "whisper") {
				if (!result?.reply && result?.reason === "filter") {
					this.pm(userData.Name, sb.Config.get("PRIVATE_MESSAGE_COMMAND_FILTERED"));
				}
				else if (result?.reason === "no-command") {
					this.pm(userData.Name, sb.Config.get("PRIVATE_MESSAGE_NO_COMMAND"));
				}
			}
		}
		else if (messageType === "whisper") {
			this.pm(userData.Name, sb.Config.get("PRIVATE_MESSAGE_UNRELATED"));
		}
	}

	async handleHost (type, to, from, viewers) {
		const hostedChannelData = sb.Channel.get(from);
		const hostingChannelData = sb.Channel.get(to);

		if (hostedChannelData && typeof hostedChannelData.Custom_Code === "function") {
			const hosterData = await sb.User.get(to, false);
			hostedChannelData.Custom_Code({
				type: type + "ed",
				hostedBy: hosterData,
				viewers: viewers
			});
		}

		if (hostingChannelData && typeof hostingChannelData.Custom_Code === "function") {
			const targetData = await sb.User.get(from, false);
			hostingChannelData.Custom_Code({
				type: type + "ing",
				hosting: targetData,
				viewers: viewers
			});
		}

		if (this.platform.Logging.hosts) {
			sb.SystemLogger.send("Twitch.Host", `${type}: ${from} => ${to} for ${viewers} viewers`);
		}
	}

	/**
	 * Handles a command being used.
	 * @param {string} command
	 * @param {string} user
	 * @param {string} channel
	 * @param {string[]} [args]
	 * @param {Object} options = {}
	 * @returns {boolean} Whether or not a command has been executed.
	 */
	async handleCommand (command, user, channel, args = [], options = {}) {
		const userData = await sb.User.get(user, false);
		const channelData = (channel === null) ? null : sb.Channel.get(channel);
		const execution = await sb.Command.checkAndExecute(command, args, channelData, userData, {
			platform: this.platform,
			...options
		});

		if (!execution || !execution.reply) {
			return execution;
		}

		if (options.privateMessage || execution.replyWithPrivateMessage) {
			const message = await sb.Master.prepareMessage(execution.reply, null, {
				platform: this.platform,
				extraLength: ("/w " + userData.Name + " ").length
			});

			this.pm(userData.Name, message);
		}
		else {
			if (channelData?.Mirror) {
				this.mirror(execution.reply, userData, channelData, true);
			}

			const message = await sb.Master.prepareMessage(execution.reply, channelData, { skipBanphrases: true });
			if (message) {
				this.send(message, channelData);
			}
		}

		return execution;
	}

	/**
	 * Reacts to user timeouts and bans alike
	 * @param {string} user
	 * @param {string} channel
	 * @param {string} [reason]
	 * @param {number} [length]
	 * @returns {Promise<void>}
	 */
	async handleBan (user, channel, reason = null, length = null) {
		const channelData = sb.Channel.get(channel);
		if (channelData) {
			if (typeof channelData.sessionData.recentBans === "undefined") {
				channelData.sessionData.recentBans = 0;
			}

			if (!channelData.sessionData.parted && channelData.sessionData.recentBans > sb.Config.get("TWITCH_RECENT_BANS_THRESHOLD")) {
				console.debug(`Parting channel ${channelData.Name} because ban threshold has been exceeded!`);

				channelData.sessionData.parted = true;
				this.client.part(channelData.Name);

				setTimeout(() => {
					console.debug(`Re-joining channel ${channelData.Name}!`);

					channelData.sessionData.parted = false;
					this.client.join(channelData.Name)
				}, 60_000);
			}

			channelData.sessionData.recentBans++;

			if (this.platform.Logging.bans) {
				sb.Logger.logBan(user, channelData, length, new sb.Date(), reason);
			}
		}
	}

	/**
	 * Reacts to users subscribing to a given channel.
	 * @param {string} username
	 * @param {string} channel
	 * @param {string} plan
	 * @param {string} [message]
	 * @param {Object} months
	 * @param {number} months.total Total amount of months susbscribed.
	 * @param {number} months.streak Total amount of months susbscribed in a row.
	 * @returns {Promise<void>}
	 */
	async handleSubscription (username, channel, plan, message, months)  {
		const userData = await sb.User.get(username, false);
		const channelData = sb.Channel.get(channel);
		const plans = sb.Config.get("TWITCH_SUBSCRIPTION_PLANS");

		if (channelData && channelData.Custom_Code) {
			channelData.Custom_Code({
				type: "subscribe",
				user: userData,
				months: months.total,
				streak: months.streak,
				message: message,
				plan: plans[plan]
			});
		}

		if (this.platform.Logging.subs) {
			sb.SystemLogger.send("Twitch.Sub", plans[plan], channelData, userData);
		}
	}

	/**
	 * Reacts to a gifted subscription event.
	 * @param {string} channel The channel, where the subs were gifted.
	 * @param {string} gifter The username of subs gifter.
	 * @param {Object} data
	 * @param {number} data.gifted The amount of subs gifted in a specific batch.
	 * @param {number} data.totalCount Total amount of gifts sent in the channel by the gifter.
	 * @param {User} data.recipient = null Recipient of the gift, null if there were multiple gifted subs.
	 * @param {number} data.months = null Cumulative months of the gift sub, null if there were multiple gifted subs.
	 */
	async handleGiftedSubscription (channel, gifter, data) {
		const channelData = sb.Channel.get(channel);
		// This is a change from usual behaviour - ignore Inactive channels, but do log Read-only channels
		if (channelData.Mode === "Inactive") {
			return;
		}

		const gifterData = await sb.User.get(gifter, true);
		if (channelData && typeof channelData.Custom_Code === "function") {
			channelData.Custom_Code({
				type: "subgift",
				subsGifted: data.gifted,
				gifter: gifterData,
				recipient: data.recipient || null,
				months: data.months || null,
				plan: null // @todo - find in event sub/resub.methods
			});
		}

		if (!gifterData) {
			return;
		}

		if (this.platform.Logging.giftSubs) {
			const logMessage = (data.recipient)
				? (gifterData.Name + " gifted a subscription to " + data.recipient.Name)
				: (gifterData.Name + " gifted " + data.gifted + " subs");

			sb.SystemLogger.send("Twitch.Giftsub", logMessage, channelData, data.recipient || null);
		}
	}

	/**
	 * Determines if a user is an owner of a given channel.
	 * @param {Channel} channelData
	 * @param {User} userData
	 * @returns {boolean}
	 */
	isUserChannelOwner (channelData, userData) {
		if (userData === null || channelData === null) {
			return false;
		}

		return (channelData.Specific_ID === userData.Twitch_ID);
	}

	mirror (message, userData, channelData, commandUsed = false) {
		const fixedMessage = (commandUsed)
			? `${this.platform.Mirror_Identifier} ${message}`
			: `${this.platform.Mirror_Identifier} ${userData.Name}: ${message}`;

		sb.Master.mirror(fixedMessage, userData, channelData.Mirror);
	}

	destroy () {
		this.client.disconnect();

		this.client = null;
		this.selfUserData = null;
	}

	restart (hard) {
		setTimeout(() => sb.Master.reloadClientModule(this.platform, hard), 10.0e3);
		this.destroy();
	}
};