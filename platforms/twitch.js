const { CronJob } = require("cron");
const DankTwitch = require("@kararty/dank-twitch-irc");

const WebSocket = require("ws");
const APP_ACCESS_CACHE_KEY = "twitch-app-access-token";
const CONDUIT_ID_KEY = "twitch-conduit-id";

const getAppAccessToken = async () => {
	const cacheToken = await sb.Cache.getByPrefix(APP_ACCESS_CACHE_KEY);
	if (cacheToken) {
		return cacheToken;
	}

	const response = await sb.Got("GenericAPI", {
		url: "https://id.twitch.tv/oauth2/token",
		method: "POST",
		searchParams: {
			grant_type: "client_credentials",
			client_id: sb.Config.get("TWITCH_CLIENT_ID"),
			client_secret: sb.Config.get("TWITCH_CLIENT_SECRET")
		}
	});

	if (!response.ok) {
		throw new sb.Error({
			message: "Could not fetch app access token!",
			args: { response }
		});
	}

	const token = response.body.access_token;
	await sb.Cache.setByPrefix(APP_ACCESS_CACHE_KEY, token, {
		expiry: (response.body.expires_in * 1000)
	});

	return token;
};

const getConduitId = async () => {
	const cacheId = await sb.Cache.getByPrefix(CONDUIT_ID_KEY);
	if (cacheId) {
		return cacheId;
	}

	const appToken = await getAppAccessToken();
	const response = await sb.Got("GenericAPI", {
		url: "https://api.twitch.tv/helix/eventsub/conduits",
		method: "POST",
		responseType: "json",
		throwHttpErrors: false,
		headers: {
			Authorization: `Bearer ${appToken}`,
			"Client-Id": sb.Config.get("TWITCH_CLIENT_ID")
		},
		json: { shard_count: 1 }
	});

	if (!response.ok) {
		throw new sb.Error({
			message: "Could not obtain conduit id",
			args: { response }
		});
	}

	const [shard] = response.body.data;
	await sb.Cache.setByPrefix(CONDUIT_ID_KEY, shard.id);
	return shard.id;
};

const assignWebsocketToConduit = async (sessionId) => {
	const conduitId = await getConduitId();
	const appToken = await getAppAccessToken();

	const response = await sb.Got("GenericAPI", {
		method: "PATCH",
		url: "https://api.twitch.tv/helix/eventsub/conduits/shards",
		responseType: "json",
		throwHttpErrors: false,
		headers: {
			Authorization: `Bearer ${appToken}`,
			"Client-Id": sb.Config.get("TWITCH_CLIENT_ID")
		},
		json: {
			conduit_id: conduitId,
			shards: [{
				id: 0,
				transport: {
					method: "websocket",
					session_id: sessionId
				}
			}]
		}
	});

	if (!response.ok) {
		throw new sb.Error({
			message: "Could not assign WS to conduit",
			args: { response }
		});
	}
};

const createSubscription = async (data = {}) => {
	const conduitId = await getConduitId();
	const appToken = await getAppAccessToken();

	const { subscription, version, selfId, channelId } = data;
	let condition;
	if (!channelId) {
		condition = { user_id: selfId };
	}
	else if (!selfId) {
		condition = { broadcaster_user_id: channelId };
	}
	else {
		condition = {
			user_id: selfId,
			broadcaster_user_id: channelId
		};
	}

	const response = await sb.Got("GenericAPI", {
		url: "https://api.twitch.tv/helix/eventsub/subscriptions",
		method: "POST",
		responseType: "json",
		throwHttpErrors: false,
		headers: {
			Authorization: `Bearer ${appToken}`,
			"Client-Id": sb.Config.get("TWITCH_CLIENT_ID")
		},
		json: {
			type: subscription,
			version,
			condition,
			transport: {
				method: "conduit",
				conduit_id: conduitId
			}
		}
	});

	if (!response.ok) {
		// Conflict - subscription already exists
		if (response.statusCode === 409) {
			/**
			 * @todo
			 * add some kind of Redis subscription caching or do one big request at start to
			 * figure out all the subscriptions we have going on currently, so we don't have to
			 * handle all the re-requesting failures here
			 */
		}
		else {
			console.warn("Could not subscribe", {
				subscription: data,
				selfId,
				channelId,
				response
			});
		}
	}
};

const createChannelChatMessageSubscription = async (selfId, channelId) => createSubscription({
	channelId,
	selfId,
	subscription: "channel.chat.message",
	version: "1"
});

const createWhisperMessageSubscription = async (selfId) => createSubscription({
	selfId,
	subscription: "user.whisper.message",
	version: "1"
});

const createChannelBanSubscription = async (channelId) => createSubscription({
	channelId,
	subscription: "channel.ban",
	version: "1"
});

// Reference: https://github.com/SevenTV/API/blob/master/data/model/emote.model.go#L68
// Flag name: EmoteFlagsZeroWidth
const SEVEN_TV_ZERO_WIDTH_FLAG = 1 << 8;
const FALLBACK_WHISPER_MESSAGE_LIMIT = 2500;
const WRITE_MODE_MESSAGE_DELAY = 1500;

const DEFAULT_LOGGING_CONFIG = {
	bans: false,
	bits: false,
	channelJoins: false,
	clearchat: false,
	giftSubs: false,
	rituals: true,
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

const specialEmoteSetMap = {
	472873131: "300636018", // Haha emotes
	488737509: "300819901", // Luv emotes
	537206155: "301450851", // Pride emotes
	564265402: "301965751", // Hyper emotes
	592920959: "302430190", // KPOP emotes
	610186276: "302778679" // 2020 emotes
};

const fetchToken = async () => {
	if (!sb.Config.has("TWITCH_REFRESH_TOKEN", true)) {
		throw new sb.Error({
			message: "No Twitch refresh token available!"
		});
	}

	const response = await sb.Got("GenericAPI", {
		url: "https://id.twitch.tv/oauth2/token",
		method: "POST",
		searchParams: {
			grant_type: "refresh_token",
			refresh_token: sb.Config.get("TWITCH_REFRESH_TOKEN"),
			client_id: sb.Config.get("TWITCH_CLIENT_ID"),
			client_secret: sb.Config.get("TWITCH_CLIENT_SECRET")
		}
	});

	const expirationTimestamp = sb.Date.now() + (response.body.expires_in * 1000);
	const authToken = response.body.access_token;

	await Promise.all([
		sb.Cache.setByPrefix("TWITCH_OAUTH", authToken, { expiry: response.body.expires_in * 1000 }),
		sb.Config.set("TWITCH_OAUTH", authToken),
		sb.Config.set("TWITCH_OAUTH_EXPIRATION", expirationTimestamp),
		sb.Config.set("TWITCH_REFRESH_TOKEN", response.body.refresh_token)
	]);

	return authToken;
};

const emitRawUserMessageEvent = (username, channelName, message) => {
	if (!username || !channelName) {
		throw new sb.Error({
			message: "No username or channel name provided for raw event",
			args: {
				username,
				channelName,
				message
			}
		});
	}

	const channelData = sb.Channel.get(channelName, sb.Platform.get("twitch"));
	if (channelData) {
		channelData.events.emit("message", {
			event: "message",
			message: message.text,
			user: null,
			channel: channelData,
			platform: sb.Platform.get("twitch"),
			raw: {
				user: username
			},
			messageData: message
		});
	}
};

const userChannelActivityPrefix = "twitch-user-activity-";
const populateUserChannelActivity = async (userData, channelData) => {
	const key = `${userChannelActivityPrefix}-${channelData.ID}-${userData.Name}`;
	await sb.Cache.setByPrefix(key, "1", {
		expiry: 36e5 // 60 minutes
	});
};

const getActiveUsernamesInChannel = async (channelData) => {
	const prefix = `${userChannelActivityPrefix}-${channelData.ID}-`;
	const prefixes = await sb.Cache.getKeysByPrefix(`${prefix}*`, {});

	return prefixes.map(i => i.replace(prefix, ""));
};

const populateChannelsLiveStatus = async () => {
	let counter = 0;
	const promises = [];
	const batchSize = 100;
	const rawChannelList = await sb.Channel.getLiveEventSubscribedChannels("twitch");
	const channelList = rawChannelList.filter(i => i.Specific_ID);

	while (counter < channelList.length) {
		const sliceString = channelList
			.slice(counter, counter + batchSize)
			.map(i => `user_id=${i.Specific_ID}`)
			.join("&");

		promises.push(sb.Got("Helix", {
			url: `streams?${sliceString}`,
			responseType: "json"
		}));

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

			channelData.events.emit("offline-passthrough", {
				event: "offline-passthrough",
				channel: channelData
			});

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

			channelData.events.emit("online-passthrough", {
				event: "online-passthrough",
				stream: currentStreamData.stream,
				channel: channelData
			});

			streamData.live = true;
			streamData.stream = currentStreamData;
		}

		await channelData.setStreamData(streamData);
	});

	await Promise.all(channelPromises);
};

module.exports = class TwitchPlatform extends require("./template.js") {
	supportsMeAction = true;
	dynamicChannelAddition = true;

	// @todo remove this cron and replace with offline/online EventSub handlers
	#channelLiveStatusCron = new CronJob("0 */1 * * * *", () => populateChannelsLiveStatus());

	#tokenCheckInterval = setInterval(() => this.#checkAuthToken(), 60_000);
	#lastWebsocketKeepaliveMessage = 0;
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

		this.rejectedMessageTimeouts = {};

		this.availableEmotes = [];
		this.availableEmoteSets = [];
		this.recentEmoteFetchTimeout = 0;
	}

	async connect () {
		const ws = new WebSocket("wss://eventsub.wss.twitch.tv/ws");
		ws.on("message", (data) => this.handleWebsocketMessage(data));

		this.client = ws;

		const channelList = sb.Channel.getJoinableForPlatform(this);
		const joinPromises = channelList.flatMap(async (channelData) => [
			createChannelChatMessageSubscription(this.selfId, channelData.Specific_ID),
			createChannelBanSubscription(channelData.Specific_ID)
		]);

		await Promise.all([
			...joinPromises,
			createWhisperMessageSubscription(this.selfId)
		]);
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
				this.#lastWebsocketKeepaliveMessage = sb.Date.now();
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
				await this.handleBan(event.user_login, event.broadcaster_user_login, {
					reason: event.reason ?? null,
					isPermanent: event.is_permanent,
					ends: (event.ends_at) ? new sb.Date(event.ends_at) : null
				});

				break;
			}

			default: {
				console.warn("Unrecognized notification", { data });
			}
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

				const result = await this.executeChannelRename(channelData);
				if (result.reason === "channel-suspended") {
					await sb.Logger.log("Twitch.Fail", `Channel ${channelData.Name} unavailable - set to Inactive`, channelData, null);
				}
				else if (result.reason === "channel-id-mismatch") {
					await sb.Logger.log("Twitch.Warning", `Possible user rename has a mismatched user ID. Data dump: ${JSON.stringify(result)}`, channelData, null);
				}
				else if (result.action && result.action.includes("rename") && result.login) {
					const suggestionIDs = await sb.Query.getRecordset(rs => rs
						.select("ID")
						.from("data", "Suggestion")
						.where("Category = %s", "Bot addition")
						.where("Status IS NULL")
						.where("Text %*like*", result.login)
						.flat("ID"));

					for (const ID of suggestionIDs) {
						const row = await sb.Query.getRow("data", "Suggestion");
						await row.load(ID);

						row.values.Status = "Completed";
						row.values.Notes = `Completed due to automatic rename detection\n\n${row.values.Notes}`;
						await row.save({ skipLoad: true });
					}
				}
				else if (result.success === true) {
					await sb.Logger.log("Twitch.Other", `Channel rename: ${JSON.stringify({
						result,
						error
					})}`, channelData, null);
				}
			}
		});

		client.on("JOIN", async (message) => {
			if (message.joinedUsername !== this.selfName.toLowerCase()) {
				return;
			}

			const { channelName } = message;
			const channelData = sb.Channel.get(channelName);
			channelData.sessionData.joined = true;
			channelData.sessionData.parted = false;

			// @todo: Could this possibly be a part of channelData? So that it is platform-independent...
			const {
				channels,
				string
			} = this.config.reconnectAnnouncement;

			const sayPromises = [];
			if (channels && string && channels.includes(channelName)) {
				sayPromises.push(client.say(channelName, string));
			}

			await Promise.allSettled(sayPromises);
		});

		client.on("PART", (message) => {
			if (message.partedUsername !== this.selfName.toLowerCase()) {
				return;
			}

			const channelData = sb.Channel.get(message.channelName);
			channelData.sessionData.joined = false;
			channelData.sessionData.parted = true;
		});

		client.on("USERSTATE", async (messageObject) => {
			const now = sb.Date.now();

			if (!this.config.updateAvailableBotEmotes) {
				return;
			}
			else if (this.recentEmoteFetchTimeout > now) {
				return;
			}

			const incomingEmoteSets = messageObject.emoteSets;
			if (this.availableEmotes.length === 0 || incomingEmoteSets.sort()
				.join(",") !== this.availableEmoteSets.sort()
				.join(",")) {
				this.availableEmoteSets = incomingEmoteSets;

				const timeout = this.config.emoteFetchTimeout ?? 10_000;
				this.recentEmoteFetchTimeout = now + timeout;

				let emotes;
				try {
					emotes = await TwitchPlatform.fetchTwitchEmotes(this.availableEmoteSets);
				}
				catch {
					emotes = null;
				}

				if (emotes) {
					this.availableEmotes = emotes;
					await this.invalidateGlobalEmotesCache();
				}
			}
		});

		client.on("NOTICE", async ({
			channelName,
			messageID,
			...rest
		}) => {
			if (!messageID) {
				return;
			}

			const channelData = sb.Channel.get(channelName, this);
			switch (messageID) {
				case "msg_rejected":
				case "msg_rejected_mandatory": {
					const json = JSON.stringify({
						channelName,
						messageID,
						rest
					});
					await sb.Logger.log("Twitch.Warning", `Rejected message: ${json}`, channelData);

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
						await sb.Logger.log("Twitch.Ban", `Bot banned in channel ${channelData.Name}. Previous mode: ${previousMode}`, channelData),
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

		client.on("USERNOTICE", (message) => this.handleUserNotice(message));
	}

	/**
	 * Sends a message, respecting each channel's current setup and limits
	 * @param {string} message
	 * @param {Channel|string} channel
	 */
	async send (message, channel) {
		const channelData = sb.Channel.get(channel, this);
		if (channelData.Mode === "Inactive" || channelData.Mode === "Read") {
			return;
		}

		message = message.replace(/\s+/g, " ").trim();

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
			// broadcaster_user_id: channelId, // currently unused
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
			type: event.message_type, // text, channel_points_highlighted, channel_points_sub_only, user_intro, animated, gigantified_emote
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

		const channelData = sb.Channel.get(channelName, this);
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
			const remainder = messageData.slice(reply.parent_user_login.length + 2);
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
					await this.me(channelData, message);
				}
				else {
					await this.send(message, channelData);
				}
			}
		}

		return execution;
	}

	/**
	 * Reacts to user timeouts and bans - mostly for logging
	 * @param {string} user
	 * @param {string} channel
	 * @param {Object} data
	 * @param {string} data.reason
	 * @param {boolean} data.isPermanent
	 * @param {number} data.endsAt
	 * @returns {Promise<void>}
	 */
	async handleBan (user, channel, data = {}) {
		const channelData = sb.Channel.get(channel, this);
		if (!channelData) {
			return;
		}

		// @todo this probably shouldn't be necessary with Websocket + Conduits?
		if (user === this.selfName && data.isPermanent && this.config.partChannelsOnPermaban) {
			const previousMode = channelData.Mode;
			await Promise.all([
				channelData.setDataProperty("inactiveReason", "bot-banned"),
				channelData.saveProperty("Mode", "Inactive"),
				sb.Logger.log("Twitch.Ban", `Bot banned in channel ${channelData.Name}. Previous mode: ${previousMode}`, channelData)
			]);
		}

		const userData = await sb.User.get(user);
		if (!userData) {
			return;
		}

		const logString = JSON.stringify({ user, channel, data });
		if (data.isPermanent && this.logging.bans) {
			await sb.Logger.log("Twitch.Ban", `Permaban: ${logString}`, channelData, userData);
		}
		else if (!data.isPermanent && this.logging.timeouts) {
			await sb.Logger.log("Twitch.Timeout", `Timeout: ${logString}`, channelData, userData);
		}
	}

	async handleUserNotice (messageObject) {
		const {
			messageText,
			messageTypeID,
			senderUsername,
			channelName
		} = messageObject;

		// ignore these events
		if (this.config.ignoredUserNotices.includes(messageTypeID)) {
			return;
		}

		const userData = await sb.User.get(senderUsername);
		const channelData = sb.Channel.get(channelName, this);
		if (!channelData) {
			return;
		}

		const eventSkipModes = ["Read", "Last seen", "Inactive"];
		const logSkipModes = ["Inactive", "Last seen"];
		const plans = this.config.subscriptionPlans;

		if (messageObject.isSub() || messageObject.isResub()) {
			const {
				cumulativeMonths,
				streakMonths,
				subPlanName
			} = messageObject.eventParams;

			if (!eventSkipModes.includes(channelData.Mode)) {
				channelData.events.emit("subscription", {
					event: "subscription",
					message: messageText,
					user: userData,
					channel: channelData,
					platform: this,
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

			if (this.logging.subs && !logSkipModes.includes(channelData.Mode)) {
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
					platform: this,
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

			if (this.logging.giftSubs && !logSkipModes.includes(channelData.Mode)) {
				const name = userData?.Name ?? "(anonymous)";
				const logMessage = `${name} gifted a subscription to ${recipientData.Name}`;

				await sb.Logger.log("Twitch.Giftsub", logMessage, channelData, userData);
			}
		}
		else if (messageObject.isRaid()) {
			const viewers = messageObject.eventParams.viewerCount;
			if (!eventSkipModes.includes(channelData.Mode)) {
				channelData.events.emit("raid", {
					event: "raid",
					message: messageText ?? null,
					channel: channelData,
					user: userData,
					platform: this,
					data: {
						viewers
					}
				});
			}

			if (this.logging.hosts && !logSkipModes.includes(channelData.Mode)) {
				await sb.Logger.log("Twitch.Host", `Raid: ${userData?.Name ?? null} => ${channelData.Name} for ${viewers} viewers`);
			}
		}
		else if (messageObject.isRitual()) {
			if (this.logging.rituals && !logSkipModes.includes(channelData.Mode)) {
				const userData = await sb.User.get(senderUsername, false);
				const channelData = sb.Channel.get(channelName, this);

				await sb.Logger.log("Twitch.Ritual", `${messageObject.systemMessage} ${messageText}`, channelData, userData);
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

	/**
	 * @param {Channel} channelData
	 * @param {string} message
	 * @returns {Promise<void>}
	 */
	async me (channelData, message) {
		await this.client.me(channelData.Name, message);
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
			const {
				statusCode,
				body
			} = await sb.Got("Leppunen", {
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
				animated: (i.assetType === "ANIMATED"),
				follower: (i.type === "FOLLOWER")
			}))
		}));
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
		const [bttv, ffz, sevenTv] = await Promise.allSettled([
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

		const rawFFZEmotes = Object.values(ffz.value?.body.sets ?? {});
		const rawBTTVEmotes = (bttv.value?.body && typeof bttv.value?.body === "object")
			? Object.values(bttv.value.body)
			: [];
		const rawSevenTvEmotes = (sevenTv.value?.body && Array.isArray(sevenTv.value?.body?.emotes))
			? sevenTv.value.body?.emotes
			: [];

		const twitchEmotes = this.availableEmotes.flatMap(set => set.emotes.map(i => {
			let type = "twitch-global";

			// Massive hackfuck-workaround - animated emotes are present in their own emoteset without a tier,
			// hence a special check must be added here. Otherwise, they will be considered as global.
			if (i.animated || ["1", "2", "3"].includes(set.tier)) {
				type = "twitch-subscriber";
			}
			else if (i.follower) {
				type = "twitch-follower";
			}

			return {
				ID: i.ID,
				name: i.token,
				type,
				global: true,
				animated: i.animated
			};
		}));
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

	// noinspection JSClosureCompilerSyntax
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

		const {
			id,
			login
		} = response.body.data[0];
		if (login === channelData.Name) {
			return {
				success: false,
				reason: "no-rename",
				channel: channelData.ID,
				data: {
					id,
					login
				}
			};
		}
		else if (id !== channelData.Specific_ID) {
			return {
				success: false,
				reason: "channel-id-mismatch",
				channel: channelData.ID,
				data: {
					id,
					login
				}
			};
		}

		const previousMode = channelData.Mode;
		await channelData.setDataProperty("inactiveReason", "renamed");
		await channelData.saveProperty("Mode", "Inactive");

		const otherChannelData = sb.Channel.get(login);
		if (!otherChannelData) {
			let joinFailed = false;
			const joinedChannel = await sb.Channel.add(login, this, previousMode, channelData.Specific_ID);
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
				data: {
					id,
					joinFailed,
					login
				}
			};
		}

		return {
			success: false,
			reason: "no-action",
			data: {
				id,
				login
			}
		};
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
			token = await fetchToken();
		}

		this.client.configuration.password = `oauth:${token}`;
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
