const WebSocket = require("ws");

const {
	assignWebsocketToConduit,
	createChannelChatMessageSubscription,
	createWhisperMessageSubscription,
	// createChannelSubSubscription,
	// createChannelResubSubscription,
	// createChannelRaidSubscription,
	// createChannelOnlineSubscription,
	// createChannelOfflineSubscription,
	fetchExistingSubscriptions,
	fetchToken,
	getConduitId,
	getAppAccessToken,
	emitRawUserMessageEvent,
	getActiveUsernamesInChannel,
	populateUserChannelActivity
} = require("./twitch-utils.js");

// Reference: https://github.com/SevenTV/API/blob/master/data/model/emote.model.go#L68
// Flag name: EmoteFlagsZeroWidth
const SEVEN_TV_ZERO_WIDTH_FLAG = 1 << 8;
const FALLBACK_WHISPER_MESSAGE_LIMIT = 2500;
const WRITE_MODE_MESSAGE_DELAY = 1500;
const NO_EVENT_RECONNECT_TIMEOUT = 5000;
const LIVE_STREAMS_KEY = "twitch-live-streams";
const TWITCH_WEBSOCKET_URL = "wss://eventsub.wss.twitch.tv/ws";

const DEFAULT_LOGGING_CONFIG = {
	bits: false,
	messages: true,
	subs: false,
	timeouts: false,
	whispers: true
};
const DEFAULT_PLATFORM_CONFIG = {
	modes: {
		Moderator: {
			queueSize: 1e6,
			cooldown: 50
		},
		VIP: {
			queueSize: 50,
			cooldown: 150
		},
		Write: {
			queueSize: 5,
			cooldown: 1250
		}
	},
	subscriptionPlans: {
		1000: "$5",
		2000: "$10",
		3000: "$25",
		Prime: "Prime"
	},
	partChannelsOnPermaban: true,
	clearRecentBansTimer: 60000,
	recentBanThreshold: null,
	updateAvailableBotEmotes: false,
	ignoredUserNotices: [],
	sameMessageEvasionCharacter: "󠀀",
	rateLimits: "default",
	reconnectAnnouncement: {},
	emitLiveEventsOnlyForFlaggedChannels: false,
	suspended: false,
	joinChannelsOverride: [],
	spamPreventionThreshold: 100,
	sendVerificationChallenge: false,
	whisperMessageLimit: 500
};

module.exports = class TwitchPlatform extends require("./template.js") {
	supportsMeAction = true;
	dynamicChannelAddition = true;

	#tokenCheckInterval = setInterval(() => this.#checkAuthToken(), 60_000);
	#reconnectCheck = setInterval(() => this.#pingWebsocket(), 30_000);

	#websocketLatency = null;
	#previousMessageMeta = new Map();
	#userCommandSpamPrevention = new Map();

	constructor (config) {
		super("twitch", config, {
			logging: DEFAULT_LOGGING_CONFIG,
			platform: DEFAULT_PLATFORM_CONFIG
		});

		if (!this.selfName) {
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
	}

	async connect (options = {}) {
		await getAppAccessToken();
		await getConduitId();

		const ws = new WebSocket(options.url ?? TWITCH_WEBSOCKET_URL);
		ws.on("message", (data) => this.handleWebsocketMessage(data));

		this.client = ws;

		if (!options.skipSubscriptions) {
			const existingSubs = await fetchExistingSubscriptions();
			const existingWhisperSub = existingSubs.some(i => i.type === "user.whisper.message");

			if (!existingWhisperSub) {
				await createWhisperMessageSubscription(this.selfId);
			}

			const existingChannels = existingSubs.filter(i => i.type === "channel.chat.message").map(i => i.condition.broadcaster_user_id);
			const channelList = sb.Channel.getJoinableForPlatform(this);
			const missingChannels = channelList.filter(i => !existingChannels.includes(i.Specific_ID));

			const batchSize = 10;
			for (let index = 0; index < missingChannels.length; index += batchSize) {
				const slice = missingChannels.slice(index, index + batchSize);
				const joinPromises = this.joinChannels(slice);

				await Promise.allSettled(joinPromises);
			}
		}

		const { channels, string } = this.config.reconnectAnnouncement;
		for (const channel of channels) {
			const channelData = sb.Channel.get(channel);
			if (channelData) {
				await channelData.send(string);
			}
		}
	}

	async handleWebsocketMessage (data) {
		const event = JSON.parse(data);
		const { metadata, payload } = event;

		switch (metadata.message_type) {
			case "session_welcome": {
				const sessionId = payload.session.id;
				await assignWebsocketToConduit(sessionId);
				break;
			}

			case "session_reconnect": {
				await this.handleReconnect(event);
				break;
			}

			case "notification": {
				await this.handleWebsocketNotification(event);
				break;
			}

			case "revocation": {
				console.warn("Subscription revoked", { data });
				await sb.Logger.log(
					"Twitch.Warning",
					`Subscription revoked: ${JSON.stringify(data)}`,
					null,
					null
				);

				break;
			}

			case "session_keepalive": {
				break;
			}

			default: {
				console.log("Unrecognized message", { event });
			}
		}
	}

	async handleWebsocketNotification (data) {
		const { event, subscription } = data.payload;

		switch (subscription.type) {
			case "channel.chat.message": {
				await this.handleMessage(event);
				break;
			}

			case "user.whisper.message": {
				await this.handlePrivateMessage(event);
				break;
			}

			case "channel.ban": {
				await this.handleBan(event);
				break;
			}

			case "channel.subscribe":
			case "channel.subcription.message": {
				await this.handleSub(event, subscription.type);
				break;
			}

			case "channel.raid": {
				await this.handleRaid(event);
				break;
			}

			case "stream.online":
			case "stream.offline": {
				await this.handleStreamLiveChange(event, subscription.type);
				break;
			}

			default: {
				console.warn("Unrecognized notification", { data });
			}
		}
	}

	async handleReconnect (event) {
		const reconnectUrl = event.payload.sesion.reconnect_url;
		if (this.client) {
			this.client.close();
		}

		await this.connect({
			url: reconnectUrl,
			skipSubscriptions: true
		});
	}

	/**
	 * Sends a message, respecting each channel's current setup and limits
	 * @param {string} message
	 * @param {Channel|string} channel
	 * @param {Object} options = {}
	 * @param {boolean} [options.meAction] If `true`, adds a ".me" at the start of the message to create a "me action".
	 * If not `true`, will escape all leading command characters (period "." or slash "/") by doubling them up.
	 */
	async send (message, channel, options = {}) {
		const channelData = sb.Channel.get(channel, this);
		if (channelData.Mode === "Inactive" || channelData.Mode === "Read") {
			return;
		}

		message = message.replace(/\s+/g, " ").trim();

		if (options.meAction === true) {
			message = `.me ${message}`;
		}
		else {
			message = message.replace(/^([./])/, "$1 $1");
		}

		// Neither the "same message" nor "global" cooldowns apply to VIP or Moderator channels
		if (channelData.Mode === "Write") {
			const now = sb.Date.now();
			const { length = 0, time = 0 } = this.#previousMessageMeta.get(channelData.ID) ?? {};
			if (time + WRITE_MODE_MESSAGE_DELAY > now) {
				setTimeout(() => this.send(message, channel), now - time);
				return;
			}

			// Ad-hoc figuring out whether the message about to be sent is the same as the previous message.
			// Ideally, this is determined by string comparison, but keeping strings of last messages over
			// thousands of channels isn't exactly memory friendly. So we just keep the lengths and hope it works.
			if (message.length === length) {
				message += ` ${this.config.sameMessageEvasionCharacter}`;
			}
		}

		const response = await sb.Got("Helix", {
			url: "chat/messages",
			method: "POST",
			throwHttpErrors: false,
			json: {
				broadcaster_id: channelData.Specific_ID,
				sender_id: this.selfId,
				message
				// reply_parent_message_id // could be useful in the future!
			}
		});

		if (!response.ok) {
			console.warn("HTTP not sent!", { status: response.statusCode, body: response.body });
			return;
		}

		const messageResponse = response.body.data[0];
		if (!messageResponse.is_sent) {
			console.warn("JSON not sent!", { messageResponse });

			if (messageResponse.drop_reason.code === "channel_settings") {
				await this.send(
					channel,
					"A message that was about to be posted violated this channel's moderation settings."
				);
			}
		}
		else {
			this.#previousMessageMeta.set(channelData.ID, {
				length: message.length,
				time: sb.Date.now()
			});
		}
	}

	/**
	 * @param {string} message
	 * @param {Channel|string} channel
	 */
	async me (message, channel) {
		return await this.send(message, channel, { meAction: true });
	}

	/**
	 * Sends a private message to given user.
	 * @param {string} message
	 * @param {string} user
	 */
	async pm (message, user) {
		const joinOverride = this.config.joinChannelsOverride ?? [];
		if (this.config.suspended || joinOverride.length !== 0) {
			return;
		}

		const userData = await sb.User.get(user);
		if (!userData.Twitch_ID) {
			const response = await sb.Got("Helix", {
				url: "users",
				searchParams: {
					login: userData.Name
				}
			});

			const helixUserData = response.body?.data?.[0];
			if (!response.ok || !helixUserData) {
				throw new sb.Error({
					message: "No Helix data found for user",
					args: {
						ID: userData.ID,
						name: userData.Name
					}
				});
			}

			await userData.saveProperty("Twitch_ID", helixUserData.id);
		}

		const trimmedMessage = message
			.replace(/[\r\n]/g, " ")
			.trim();

		const whisperMessageLimit = this.config.whisperMessageLimit ?? FALLBACK_WHISPER_MESSAGE_LIMIT;
		const response = await sb.Got("Helix", {
			method: "POST",
			url: "whispers",
			searchParams: {
				from_user_id: this.selfId,
				to_user_id: userData.Twitch_ID
			},
			json: {
				message: sb.Utils.wrapString(trimmedMessage, whisperMessageLimit)
			}
		});

		this.incrementMessageMetric("sent", null);

		if (!response.ok) {
			const data = JSON.stringify({
				body: response.body,
				statusCode: response.statusCode
			});

			await sb.Logger.log("Twitch.Warning", data, null, userData);
		}
	}

	/**
	 * @param {Channel|string} channelData
	 * @param {User|string} userData
	 * @param {number|null} duration If number = timeout, if null = permaban
	 * @param {string|null} reason
	 * @returns {Promise<{ ok: boolean, statusCode: number, body: Object[] }>}
	 */
	async timeout (channelData, userData, duration = 1, reason = null) {
		if (!channelData || !userData) {
			throw new sb.Error({
				message: "Missing user or channel",
				args: {
					channelData,
					userData
				}
			});
		}

		let channelID;
		if (channelData instanceof sb.Channel) {
			if (channelData.Platform !== this) {
				throw new sb.Error({
					message: "Non-Twitch channel provided",
					args: { channelData }
				});
			}

			channelID = channelData.Specific_ID;
		}
		else {
			channelID = await this.getUserID(channelData);
		}

		if (!channelID) {
			throw new sb.Error({
				message: "Invalid channel provided",
				args: { userData }
			});
		}

		const userID = (userData instanceof sb.User) ? userData.Twitch_ID : await this.getUserID(userData);

		if (!userID) {
			throw new sb.Error({
				message: "Invalid user provided",
				args: { userData }
			});
		}

		const response = await sb.Got("Helix", {
			method: "POST",
			url: "moderation/bans",
			searchParams: {
				broadcaster_id: channelID,
				moderator_id: this.selfId
			},
			json: {
				data: {
					user_id: userID,
					duration,
					reason
				}
			}
		});

		return {
			ok: response.ok,
			statusCode: response.statusCode,
			body: response.body
		};
	}

	/**
	 * Handles incoming messages.
	 * @param {Object} event
	 * @returns {Promise<void>}
	 */
	async handleMessage (event) {
		const {
			broadcaster_user_login: channelName,
			broadcaster_user_id: channelId,
			chatter_user_login: senderUsername,
			chatter_user_id: senderUserId,
			/** @type {TwitchBadge[]} */
			badges,
			color,
			channel_points_animation_id: animationId,
			channel_points_custom_reward_id: rewardId,
			/** @type {{bits: number} | null} */
			cheer,
			/** @type {TwitchReply | null} */
			reply
		} = event;

		const messageData = {
			text: event.message.text,
			/** @type {TwitchMessageFragment[]} */
			fragments: event.message.fragments,
			type: event.message_type, // text, channel_points_highlighted, channel_points_sub_only, user_intro, animated, power_ups_gigantified_emote
			id: event.message_id,
			bits: cheer,
			badges,
			color,
			animationId,
			rewardId
		};

		const userData = await sb.User.get(senderUsername, false, { Twitch_ID: senderUserId });

		if (!userData) {
			emitRawUserMessageEvent(senderUsername, channelName, messageData);
			return;
		}
		else if (userData.Twitch_ID === null && userData.Discord_ID !== null) {
			if (!this.config.sendVerificationChallenge) {
				await userData.saveProperty("Twitch_ID", senderUserId);
			}
			else {
				if (!messageData.startsWith(sb.Command.prefix)) {
					return;
				}

				const status = await TwitchPlatform.fetchAccountChallengeStatus(userData, senderUserId);
				if (status === "Active") {
					return;
				}

				const { challenge } = await TwitchPlatform.createAccountChallenge(userData, senderUserId);
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
			await userData.saveProperty("Twitch_ID", senderUserId);
		}
		else if (userData.Twitch_ID !== senderUserId) {
			// Mismatch between senderUserID and userData.Twitch_ID means someone renamed into a different
			// user's username, or that there is a different mishap happening. This case is unfortunately exceptional
			// for the current user-database structure and the event handler must be aborted.
			const channelData = (channelName) ? sb.Channel.get(channelName, this) : null;

			if (!channelName || (channelData && sb.Command.is(messageData.text))) {
				const notified = await userData.getDataProperty("twitch-userid-mismatch-notification");
				if (!notified) {
					const replyMessage = sb.Utils.tag.trim `
						@${userData.Name}, you have been flagged as suspicious.
						This is because I have seen your Twitch username on a different account before.
						This is usually caused by renaming into an account that existed before.
						To remedy this, head into Supinic's channel chat twitch.tv/supinic and mention this.												
					`;

					if (channelData) {
						const finalMessage = await this.prepareMessage(replyMessage, channelData);
						if (!finalMessage) {
							await this.pm(replyMessage, userData.Name);
						}
						else {
							await channelData.send(finalMessage);
						}
					}
					else {
						await this.pm(replyMessage, userData.Name);
					}

					await Promise.all([
						sb.Logger.log("Twitch.Other", `Suspicious user: ${userData.Name} - ${userData.Twitch_ID}`, null, userData),
						userData.setDataProperty("twitch-userid-mismatch-notification", true)
					]);
				}
			}

			emitRawUserMessageEvent(senderUsername, channelName, messageData);

			return;
		}

		const channelData = sb.Channel.get(channelName, this) ?? sb.Channel.getBySpecificId(channelId, this);
		if (!channelData || channelData.Mode === "Inactive") {
			return;
		}

		this.resolveUserMessage(channelData, userData, messageData.text);

		if (channelData.Logging.has("Meta")) {
			await sb.Logger.updateLastSeen({
				userData,
				channelData,
				message: messageData.text
			});
		}
		if (this.logging.messages && channelData.Logging.has("Lines")) {
			await sb.Logger.push(messageData.text, userData, channelData);
		}

		/**
		 * Message events should be emitted even if the channel is in "Read" mode (see below).
		 * This is due to the fact that chat-modules listening to this event can rely on being processed,
		 * even if the channel is in read-only mode.
		 */
		channelData.events.emit("message", {
			event: "message",
			message: messageData.text,
			user: userData,
			channel: channelData,
			platform: this,
			data: messageData
		});

		// If channel is read-only, do not proceed with any processing
		// Such as un-AFK message, reminders, commands, ...
		if (channelData.Mode === "Read") {
			this.incrementMessageMetric("read", channelData);
			return;
		}

		await Promise.all([
			sb.AwayFromKeyboard.checkActive(userData, channelData),
			sb.Reminder.checkActive(userData, channelData),
			populateUserChannelActivity(userData, channelData)
		]);

		// Mirror messages to a linked channel, if the channel has one
		if (channelData.Mirror) {
			this.mirror(messageData.text, userData, channelData, { commandUsed: false });
		}

		this.incrementMessageMetric("read", channelData);

		// Own message - check the regular/vip/mod/broadcaster status, and skip
		if (channelData && senderUserId === this.selfId) {
			const flatBadges = badges.map(i => i.set_id);
			const oldMode = channelData.Mode;

			if (flatBadges.includes("moderator") || flatBadges.includes("broadcaster")) {
				channelData.Mode = "Moderator";
			}
			else if (flatBadges.includes("vip")) {
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

			return;
		}

		if (this.logging.bits && cheer) {
			sb.Logger.log("Twitch.Other", `${cheer.bits} bits`, channelData, userData);
		}

		// If the handled message is a reply to another, append its content without the username mention to the end
		// of the current one. This is so that a possible command execution can be handled with this input.
		let targetMessage = messageData.text;
		if (reply) {
			// The extra length of 2 signifies one for the "@" symbol at the start of the user mention, and the other
			// is for the space character which separates the mention from the message.
			const remainder = targetMessage.slice(reply.parent_user_login.length + 2);
			const parentMessage = reply.parent_message_body;
			targetMessage = `${remainder} ${parentMessage}`;
		}

		if (!sb.Command.is(targetMessage)) {
			return;
		}

		const now = sb.Date.now();
		const timeout = this.#userCommandSpamPrevention.get(userData.ID);
		if (typeof timeout === "number" && timeout > now) {
			return;
		}

		const threshold = this.config.spamPreventionThreshold ?? 100;
		this.#userCommandSpamPrevention.set(userData.ID, now + threshold);

		const [command, ...args] = targetMessage
			.replace(sb.Command.prefix, "")
			.split(/\s+/)
			.filter(Boolean);

		await this.handleCommand(command, userData, channelData, args, messageData);
	}

	/**
	 * Handles incoming private messages.
	 * Split from original single handleMessage handler, due to simplified flow for both methods.
 	 * @param {Object} event
	 * @return {Promise<void>}
	 */
	async handlePrivateMessage (event) {
		const {
			from_user_login: senderUsername,
			from_user_id: senderUserId
		} = event;

		const userData = await sb.User.get(senderUsername, false, { Twitch_ID: senderUserId });
		if (!userData) {
			return;
		}

		const message = event.whisper.text;
		if (this.logging.whispers) {
			await sb.Logger.push(message, userData, null, this);
		}

		this.resolveUserMessage(null, userData, message);

		if (!sb.Command.is(message)) {
			await this.pm(sb.Config.get("PRIVATE_MESSAGE_UNRELATED"), senderUsername);
			return;
		}

		const [command, ...args] = message
			.replace(sb.Command.prefix, "")
			.split(/\s+/)
			.filter(Boolean);

		const result = await this.handleCommand(command, userData, null, args, {
			privateMessage: true
		});

		if (!result || !result.success) {
			if (!result?.reply && result?.reason === "filter") {
				await this.pm(sb.Config.get("PRIVATE_MESSAGE_COMMAND_FILTERED"), senderUsername);
			}
			else if (result?.reason === "no-command") {
				await this.pm(sb.Config.get("PRIVATE_MESSAGE_NO_COMMAND"), senderUsername);
			}
		}
	}

	/**
	 * @param {Object} event
	 * @param {string} subscription
	 * @return {Promise<void>}
	 */
	async handleSub (event, subscription) {
		const plans = this.config.subscriptionPlans;

		const userData = await sb.User.get(event.user_login);
		const channelData = sb.Channel.get(event.broadcaster_user_login);
		if (!channelData) {
			return;
		}

		if (subscription === "channel.subscribe") { // First time subscriber
			channelData.events.emit("subscription", {
				event: "subscription",
				message: event.message.text,
				user: userData,
				channel: channelData,
				platform: this,
				data: {
					amount: 1,
					months: 1,
					streak: 1,
					gifted: event.is_gift,
					recipient: userData,
					plan: plans[event.tier]
				}
			});
		}
		else if (subscription === "channel.subscription.meesage") { // Resubscribe
			channelData.events.emit("subscription", {
				event: "subscription",
				message: event.message.text,
				user: userData,
				channel: channelData,
				platform: this,
				data: {
					amount: event.duration_months,
					months: event.cumulative_months,
					streak: event.streak_months ?? 1,
					gifted: false,
					recipient: userData,
					plan: plans[event.tier]
				}
			});
		}
	}

	/**
	 * @param {Object} event
	 * @return {Promise<void>}
	 */
	async handleRaid (event) {
		const targetChannelData = sb.Channel.get(event.to_broadcaster_user_id);
		if (!targetChannelData || targetChannelData.Mode === "Read" || targetChannelData.Mode === "Inactive") {
			return;
		}

		const fromUser = event.from_broadcaster_user_login;
		targetChannelData.events.emit("raid", {
			event: "raid",
			message: null,
			channel: targetChannelData,
			username: fromUser,
			platform: this,
			data: {
				viewers: event.viewers
			}
		});

		if (this.logging.hosts) {
			await sb.Logger.log("Twitch.Host", `Raid: ${fromUser} => ${targetChannelData.Name} for ${event.viewers} viewers`);
		}
	}

	async handleStreamLiveChange (event, type) {
		const channelId = event.broadcaster_user_id;
		const channelData = sb.Channel.get(channelId);
		if (!channelData) {
			return;
		}

		if (type === "channel.online") {
			channelData.events.emit("offline", {
				event: "online",
				channel: channelData
			});

			const existing = await this.getLiveChannelIdList();
			if (!existing.includes(channelId)) {
				await sb.Cache.server.lpush(LIVE_STREAMS_KEY, channelId);
			}
		}
		else {
			channelData.events.emit("offline", {
				event: "offline",
				channel: channelData
			});

			await sb.Cache.server.lrem(LIVE_STREAMS_KEY, 1, channelId);
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
		const channelData = (channel === null) ? null : sb.Channel.get(channel, this);
		const execution = await sb.Command.checkAndExecute(command, args, channelData, userData, {
			platform: this,
			...options
		});

		if (!execution || !execution.reply) {
			return execution;
		}

		const commandOptions = sb.Command.extractMetaResultProperties(execution);
		if (options.privateMessage || execution.replyWithPrivateMessage) {
			const message = await this.prepareMessage(execution.reply, null, {
				...commandOptions,
				skipBanphrases: true,
				skipLengthCheck: true
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
				if (execution.replyWithMeAction === true) {
					await this.me(message, channelData);
				}
				else {
					await this.send(message, channelData);
				}
			}
		}

		return execution;
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
		const userData = await sb.User.get(user, true);
		if (userData?.Twitch_ID) {
			return userData.Twitch_ID;
		}

		const channelInfo = await sb.Got("Helix", {
			url: "users",
			throwHttpErrors: false,
			searchParams: {
				login: user
			}
		})
			.json();

		if (!channelInfo.error && channelInfo.data.length !== 0) {
			const {
				id,
				display_name: name
			} = channelInfo.data[0];
			if (!userData) {
				await sb.User.get(name, false, { Twitch_ID: id });
			}

			return id;
		}

		return null;
	}

	async createUserMention (userData) {
		return `@${userData.Name}`;
	}

	/**
	 * Determines whether or not a user is subscribed to a given Twitch channel.
	 * @param {sb.User} userData
	 * @param {string} channelName
	 * @returns {Promise<boolean>}
	 */
	async fetchUserCacheSubscription (userData, channelName) {
		/**
		 * @type {Object[]|null}
		 */
		const subscriberList = await sb.Cache.getByPrefix(`twitch-subscriber-list-${channelName}`);
		if (!subscriberList || !Array.isArray(subscriberList)) {
			return false;
		}

		return subscriberList.some(i => i.user_id === userData.Twitch_ID);
	}

	async getLiveChannelIdList () {
		return await sb.Cache.server.lrange(LIVE_STREAMS_KEY, 0, -1);
	}

	/**
	 * Fetches a list of emote data available to the bot user.
	 * @returns {Promise<TwitchEmoteSetDataObject[]>}
	 */
	static async fetchTwitchEmotes (selfId) {
		const response = await sb.Got("Helix", {
			url: "chat/emotes/user",
			method: "GET",
			throwHttpErrors: false,
			searchParams: {
				user_id: selfId
			}
		});

		const result = response.body.data;
		if (response.body.pagination.cursor) {
			let cursor = response.body.pagination.cursor;
			while (cursor) {
				const pageResponse = await sb.Got("Helix", {
					url: "chat/emotes/user",
					method: "GET",
					throwHttpErrors: false,
					searchParams: {
						user_id: selfId,
						after: cursor
					}
				});

				result.push(...pageResponse.body.data);
				cursor = pageResponse.body.pagination.cursor ?? null;
			}
		}

		return result;
	}

	/**
	 * Fetches a list of BTTV emote data for a given channel
	 * @param {Channel} channelData
	 * @returns {Promise<TypedEmote[]>}
	 */
	static async fetchChannelBTTVEmotes (channelData) {
		const channelID = channelData.Specific_ID;
		if (!channelID) {
			throw new sb.Error({
				message: "No available ID for channel",
				args: { channel: channelData.Name }
			});
		}

		const response = await sb.Got("TwitchEmotes", {
			url: `https://api.betterttv.net/3/cached/users/twitch/${channelID}`
		});

		if (!response.ok) {
			if (response.statusCode !== 404) {
				await sb.Logger.log("Twitch.Warning", `BTTV emote fetch failed, code: ${response.statusCode}`, channelData);
			}

			return [];
		}

		const emotes = [
			...(response.body.channelEmotes ?? []),
			...(response.body.sharedEmotes ?? [])
		];

		return emotes.map(i => ({
			ID: i.id,
			name: i.code,
			type: "bttv",
			global: false,
			animated: (i.imageType === "gif"),
			zeroWidth: false
		}));
	}

	/**
	 * Fetches a list of FFZ emote data for a given channel
	 * @param {Channel} channelData
	 * @returns {Promise<TypedEmote[]>}
	 */
	static async fetchChannelFFZEmotes (channelData) {
		const response = await sb.Got("TwitchEmotes", {
			url: `https://api.frankerfacez.com/v1/room/${channelData.Name}`
		});

		if (!response.ok) {
			if (response.statusCode !== 404) {
				await sb.Logger.log("Twitch.Warning", `FFZ emote fetch failed, code: ${response.statusCode}`, channelData);
			}

			return [];
		}

		const emotes = Object.values(response.body.sets)
			.flatMap(i => i.emoticons);

		return emotes.map(i => ({
			ID: i.id,
			name: i.name,
			type: "ffz",
			global: false,
			animated: false,
			zeroWidth: false
		}));
	}

	/**
	 * Fetches a list of 7TV emote data for a given channel
	 * @param {Channel} channelData
	 * @returns {Promise<TypedEmote[]>}
	 */
	static async fetchChannelSevenTVEmotes (channelData) {
		const response = await sb.Got("TwitchEmotes", {
			url: `https://7tv.io/v3/users/twitch/${channelData.Specific_ID}`
		});

		if (!response.ok) {
			if (response.statusCode !== 404) {
				await sb.Logger.log("Twitch.Warning", `7TV emote fetch failed, code: ${response.statusCode}`, channelData);
			}

			return [];
		}

		const rawEmotes = response.body.emote_set?.emotes ?? [];
		return rawEmotes.map(i => ({
			ID: i.id,
			name: i.name,
			type: "7tv",
			global: false,
			animated: i.data.animated,
			zeroWidth: Boolean(i.data.flags & SEVEN_TV_ZERO_WIDTH_FLAG)
		}));
	}

	/**
	 * Fetches all global emotes for any context.
	 * Ideally cached for a rather long time.
	 * @returns {Promise<TypedEmote[]>}
	 */
	async populateGlobalEmotes () {
		const [twitch, bttv, ffz, sevenTv] = await Promise.allSettled([
			TwitchPlatform.fetchTwitchEmotes(this.selfId),
			sb.Got("TwitchEmotes", {
				url: "https://api.betterttv.net/3/cached/emotes/global"
			}),
			sb.Got("TwitchEmotes", {
				url: "https://api.frankerfacez.com/v1/set/global"
			}),
			sb.Got("TwitchEmotes", {
				url: "https://7tv.io/v3/emote-sets/global"
			})
		]);

		const rawTwitchEmotes = twitch.value ?? [];
		const rawFFZEmotes = Object.values(ffz.value?.body.sets ?? {});
		const rawBTTVEmotes = (bttv.value?.body && typeof bttv.value?.body === "object")
			? Object.values(bttv.value.body)
			: [];
		const rawSevenTvEmotes = (sevenTv.value?.body && Array.isArray(sevenTv.value?.body?.emotes))
			? sevenTv.value.body?.emotes
			: [];

		const twitchEmotes = rawTwitchEmotes.map(i => {
			let type = "twitch-global";
			if (i.emote_type === "subscriptions") {
				type = "twitch-subscriber";
			}
			else if (i.emote_type === "follower") {
				type = "twitch-follower";
			}

			return {
				ID: i.id,
				name: i.name,
				type,
				global: true,
				animated: i.format.includes("animated"),
				channel: i.owner_id ?? null
			};
		});
		const ffzEmotes = rawFFZEmotes.flatMap(i => i.emoticons)
			.map(i => ({
				ID: i.id,
				name: i.name,
				type: "ffz",
				global: true,
				animated: false
			}));
		const bttvEmotes = rawBTTVEmotes.map(i => ({
			ID: i.id,
			name: i.code,
			type: "bttv",
			global: true,
			animated: (i.imageType === "gif")
		}));
		const sevenTvEmotes = rawSevenTvEmotes.map(i => ({
			ID: i.id,
			name: i.name,
			type: "7tv",
			global: true,
			animated: i.data.animated,
			zeroWidth: (i.data.flags & SEVEN_TV_ZERO_WIDTH_FLAG)
		}));

		return [
			...twitchEmotes, ...ffzEmotes, ...bttvEmotes, ...sevenTvEmotes
		];
	}

	/**
	 * @param {Channel} channelData
	 * @returns {Promise<TypedEmote[]>}
	 */
	async fetchChannelEmotes (channelData) {
		const [bttv, ffz, sevenTv] = await Promise.allSettled([
			TwitchPlatform.fetchChannelBTTVEmotes(channelData),
			TwitchPlatform.fetchChannelFFZEmotes(channelData),
			TwitchPlatform.fetchChannelSevenTVEmotes(channelData)
		]);

		return [
			...(bttv.value ?? []), ...(ffz.value ?? []), ...(sevenTv.value ?? [])
		];
	}

	async populateUserList (channelIdentifier) {
		const channelData = sb.Channel.get(channelIdentifier, this);
		return await getActiveUsernamesInChannel(channelData);
	}

	fetchInternalPlatformIDByUsername (userData) {
		return userData.Twitch_ID;
	}

	async fetchUsernameByUserPlatformID (userPlatformID) {
		const response = await sb.Got("Helix", {
			url: "users",
			throwHttpErrors: false,
			searchParams: {
				id: userPlatformID
			}
		});

		if (!response.ok || response.body.data.length === 0) {
			return null;
		}

		return response.body.data[0].login;
	}

	joinChannels (channelsData) {
		if (!Array.isArray(channelsData)) {
			channelsData = [channelsData];
		}

		const promises = [];
		for (const channelData of channelsData) {
			promises.push(
				createChannelChatMessageSubscription(this.selfId, channelData.Specific_ID, this)
				// createChannelBanSubscription(channelData.Specific_ID),
				// createChannelSubSubscription(channelData.Specific_ID),
				// createChannelResubSubscription(channelData.Specific_ID),
				// createChannelRaidSubscription(channelData.Specific_ID),
				// createChannelOnlineSubscription(channelData.Specific_ID),
				// createChannelOfflineSubscription(channelData.Specific_ID)
			);
		}

		return promises;
	}

	async #checkAuthToken () {
		const now = sb.Date.now();
		const expiration = sb.Config.get("TWITCH_OAUTH_EXPIRATION", false);

		let token = sb.Config.get("TWITCH_OAUTH");
		if (!expiration || now > expiration) {
			token = await fetchToken();
		}

		const response = await sb.Got("GenericAPI", {
			url: "https://id.twitch.tv/oauth2/validate",
			throwHttpErrors: false,
			headers: {
				Authorization: `OAuth ${token}`
			}
		});

		if (!response.ok) {
			console.warn("Invalid token validation response, fetching tokens...");
			await fetchToken();
		}
	}

	#pingWebsocket () {
		const reconnectTimeout = setTimeout(() => {
			console.warn(`No ping received in ${NO_EVENT_RECONNECT_TIMEOUT}ms, reconnecting...`);
			this.client.close();
			this.connect({ skipSubscriptions: true });
		}, NO_EVENT_RECONNECT_TIMEOUT);

		const start = new sb.Date();
		this.client.once("pong", () => {
			clearTimeout(reconnectTimeout);

			const end = new sb.Date();
			this.#websocketLatency = end - start;
		});

		this.client.ping();
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
			.flat("Status"));
	}

	static async createAccountChallenge (userData, twitchID) {
		const row = await sb.Query.getRow("chat_data", "User_Verification_Challenge");
		const challenge = require("crypto")
			.randomBytes(16)
			.toString("hex");

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

	get websocketLatency () { return this.#websocketLatency; }

	destroy () {
		this.client.terminate();
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

/**
 * @typedef {Object} TwitchReply
 * @property {string} parent_message_body
 * @property {string} parent_message_id
 * @property {string} parent_user_id
 * @property {string} parent_user_login
 * @property {string} parent_user_name *
 * @property {string} thread_message_id
 * @property {string} thread_user_id
 * @property {string} thread_user_login
 * @property {string} thread_user_name
 */

/**
 * @typedef {Object} TwitchBadge
 * @property {string} set_id
 * @property {string} id
 * @property {string} info
 */

/**
 * @typedef {Object} TwitchMessageFragment
 * @property {Object|null} cheermote
 * @property {string} cheermote.prefix
 * @property {number} cheermote.bits
 * @property {number} cheermote.tier
 * @property {Object|null} emote
 * @property {string} emote.id
 * @property {string} emote.emote_set_id
 * @property {string} emote.owner_id
 * @property {Array<"animated"|"static">} emote.format
 * @property {Object|null} mention
 * @property {string} mention.user_id
 * @property {string} mention.user_name
 * @property {string} mention.user_login
 * @property {string} text
 * @property {"text"|"cheermote"|"emote"|"mention"} type
 */
