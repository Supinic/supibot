const APP_ACCESS_CACHE_KEY = "twitch-app-access-token";
const CONDUIT_ID_KEY = "twitch-conduit-id";
const USER_CHANNEL_ACTIVITY_PREFIX = "twitch-user-activity-";

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
};

const createChannelChatMessageSubscription = (selfId, channelId) => createSubscription({
	channelId,
	selfId,
	subscription: "channel.chat.message",
	version: "1"
});

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

module.exports = {
	getConduitId,
	getAppAccessToken,
	assignWebsocketToConduit,
	createChannelChatMessageSubscription,
	createWhisperMessageSubscription,
	createChannelSubSubscription,
	createChannelResubSubscription,
	createChannelRaidSubscription,
	createChannelOnlineSubscription,
	createChannelOfflineSubscription,
	fetchToken,
	emitRawUserMessageEvent,
	populateChannelsLiveStatus,
	getActiveUsernamesInChannel,
	populateUserChannelActivity
};
