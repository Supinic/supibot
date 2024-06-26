const APP_ACCESS_CACHE_KEY = "twitch-app-access-token";
const CONDUIT_ID_KEY = "twitch-conduit-id";
const USER_CHANNEL_ACTIVITY_PREFIX = "twitch-user-activity-";
const SUBSCRIPTIONS_CACHE_KEY = "twitch-subscriptions";
const SUBSCRIPTIONS_CACHE_EXPIRY = 120 * 60_000; // 60 minutes
const SUBSCRIPTIONS_CACHE_INTERVAL = 30 * 60_000; // 30 minutes, 1/4 of sub cache expiry
const TOKEN_REGENERATE_INTERVAL = 60 * 60_000; // 60 minutes

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

let conduitValidated = false;
const getConduitId = async () => {
	const appToken = await getAppAccessToken();
	const cacheId = await sb.Cache.getByPrefix(CONDUIT_ID_KEY);
	if (cacheId) {
		if (conduitValidated) {
			return cacheId;
		}

		const response = await sb.Got("GenericAPI", {
			url: "https://api.twitch.tv/helix/eventsub/conduits",
			method: "GET",
			responseType: "json",
			throwHttpErrors: false,
			headers: {
				Authorization: `Bearer ${appToken}`,
				"Client-Id": sb.Config.get("TWITCH_CLIENT_ID")
			}
		});

		if (response.ok) {
			const conduitList = response.body.data.map(i => i.id);
			if (conduitList.includes(cacheId)) {
				conduitValidated = true;
				return cacheId;
			}
			else {
				console.log("No valid conduit found, re-making...");
			}
		}
		else {
			console.log("Could not check for conduit validity, re-making...");
		}
	}

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

	const {
		subscription,
		condition: customCondition,
		version,
		selfId,
		channelId
	} = data;

	let condition;
	if (customCondition) {
		condition = customCondition;
	}
	else if (!channelId) {
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
				subscription,
				selfId,
				channelId,
				response: response.body
			});
		}
	}

	return { response };
};

const createChannelChatMessageSubscription = async (selfId, channelId, platform) => {
	const { response } = await createSubscription({
		channelId,
		selfId,
		subscription: "channel.chat.message",
		version: "1"
	});

	if (!response.ok && response.statusCode === 403) {
		/** @type {Channel} */
		const channelData = sb.Channel.getBySpecificId(channelId, platform);
		await Promise.all([
			channelData.saveProperty("Mode", "Inactive"),
			channelData.setDataProperty("twitchNoScopeDisabled", true)
		]);
	}
};

const createWhisperMessageSubscription = (selfId) => createSubscription({
	selfId,
	subscription: "user.whisper.message",
	version: "1"
});

const createChannelSubSubscription = (channelId) => createSubscription({
	channelId,
	subscription: "channel.subscribe",
	version: "1"
});

const createChannelResubSubscription = (channelId) => createSubscription({
	channelId,
	subscription: "channel.subscription.message",
	version: "1"
});

const createChannelRaidSubscription = (channelId) => createSubscription({
	condition: {
		to_broadcaster_user_id: channelId
	},
	subscription: "channel.raid",
	version: "1"
});

const createChannelOnlineSubscription = (channelId) => createSubscription({
	channelId,
	subscription: "stream.online",
	version: "1"
});

const createChannelOfflineSubscription = (channelId) => createSubscription({
	channelId,
	subscription: "stream.offline",
	version: "1"
});

const getExistingSubscriptions = async (force = false) => {
	if (!force) {
		const cacheData = await sb.Cache.getByPrefix(SUBSCRIPTIONS_CACHE_KEY);
		if (cacheData) {
			return cacheData;
		}
	}

	const subscriptions = await fetchExistingSubscriptions();
	await sb.Cache.setByPrefix(SUBSCRIPTIONS_CACHE_KEY, subscriptions, {
		expiry: SUBSCRIPTIONS_CACHE_EXPIRY
	});

	return subscriptions;
};

const fetchExistingSubscriptions = async () => {
	const accessToken = await getAppAccessToken();
	const response = await sb.Got("GenericAPI", {
		url: "https://api.twitch.tv/helix/eventsub/subscriptions",
		method: "GET",
		responseType: "json",
		throwHttpErrors: false,
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Client-Id": sb.Config.get("TWITCH_CLIENT_ID")
		},
		searchParams: {
			status: "enabled"
		}
	});

	const result = [...response.body.data];
	let cursor = response.body.pagination?.cursor ?? null;
	while (cursor) {
		const loopResponse = await sb.Got("GenericAPI", {
			url: "https://api.twitch.tv/helix/eventsub/subscriptions",
			method: "GET",
			responseType: "json",
			throwHttpErrors: false,
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Client-Id": sb.Config.get("TWITCH_CLIENT_ID")
			},
			searchParams: {
				status: "enabled",
				after: cursor
			}
		});

		result.push(...loopResponse.body.data);
		cursor = loopResponse.body.pagination?.cursor ?? null;
	}

	return result;
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

const populateUserChannelActivity = async (userData, channelData) => {
	const key = `${USER_CHANNEL_ACTIVITY_PREFIX}-${channelData.ID}-${userData.Name}`;
	await sb.Cache.setByPrefix(key, "1", {
		expiry: 36e5 // 60 minutes
	});
};

const getActiveUsernamesInChannel = async (channelData) => {
	const prefix = `${USER_CHANNEL_ACTIVITY_PREFIX}-${channelData.ID}-`;
	const prefixes = await sb.Cache.getKeysByPrefix(`${prefix}*`, {});

	return prefixes.map(i => i.replace(prefix, ""));
};

const initTokenCheckInterval = async () => {
	const now = sb.Date.now();
	const expiration = sb.Config.get("TWITCH_OAUTH_EXPIRATION", false) ?? 0;

	if (now + TOKEN_REGENERATE_INTERVAL >= expiration) {
		await fetchToken();
	}

	setInterval(async () => await fetchToken(), TOKEN_REGENERATE_INTERVAL);
};

const initSubCacheCheckInterval = () => {
	setInterval(async () => await getExistingSubscriptions(true), SUBSCRIPTIONS_CACHE_INTERVAL / 2);
};

const sanitizeMessage = (string) => string.replace(/^\x01ACTION (.+)\x01$/, "$1");

module.exports = {
	getConduitId,
	getAppAccessToken,
	assignWebsocketToConduit,
	fetchExistingSubscriptions,
	getExistingSubscriptions,
	createChannelChatMessageSubscription,
	createWhisperMessageSubscription,
	createChannelSubSubscription,
	createChannelResubSubscription,
	createChannelRaidSubscription,
	createChannelOnlineSubscription,
	createChannelOfflineSubscription,
	fetchToken,
	emitRawUserMessageEvent,
	getActiveUsernamesInChannel,
	populateUserChannelActivity,
	initTokenCheckInterval,
	initSubCacheCheckInterval,
	sanitizeMessage
};
