import { Subscription, SubscriptionCondition, TwitchPlatform, MessageSubscriptionData } from "./twitch.js";
import { SupiError } from "supi-core";
import User from "../classes/user.js";
import Channel from "../classes/channel.js";

const { env } = globalThis.process;

const APP_ACCESS_CACHE_KEY = "twitch-app-access-token";
const CONDUIT_ID_KEY = "twitch-conduit-id";
const USER_CHANNEL_ACTIVITY_PREFIX = "twitch-user-activity-";
const SUBSCRIPTIONS_CACHE_KEY = "twitch-subscriptions";
const SUBSCRIPTIONS_CACHE_EXPIRY = 120 * 60_000; // 60 minutes
const SUBSCRIPTIONS_CACHE_INTERVAL = 30 * 60_000; // 30 minutes, 1/4 of sub cache expiry
const TOKEN_REGENERATE_INTERVAL = 60 * 60_000; // 60 minutes

// @todo create specific type extensions for specific subscriptions (might not be needed)


type AccessTokenData = {
	access_token: string;
	refresh_token: string;
	expires_in: number;
	scope: string | string[];
	token_type: string;
};

const getAppAccessToken = async (): Promise<string> => {
	const cacheToken = await sb.Cache.getByPrefix(APP_ACCESS_CACHE_KEY) as string | undefined;
	if (cacheToken) {
		return cacheToken;
	}

	const response = await sb.Got.get("GenericAPI")<AccessTokenData>({
		url: "https://id.twitch.tv/oauth2/token",
		method: "POST",
		searchParams: {
			grant_type: "client_credentials",
			client_id: env.TWITCH_CLIENT_ID,
			client_secret: env.TWITCH_CLIENT_SECRET
		}
	});

	if (!response.ok) {
		throw new sb.Error({
			message: "Could not fetch app access token!",
			args: { body: response.body }
		});
	}

	const token = response.body.access_token;
	await sb.Cache.setByPrefix(APP_ACCESS_CACHE_KEY, token, {
		expiry: (response.body.expires_in * 1000)
	});

	return token;
};

let conduitValidated = false;
const getConduitId = async (): Promise<string> => {
	const appToken = await getAppAccessToken();
	const cacheId = await sb.Cache.getByPrefix(CONDUIT_ID_KEY) as string | undefined;
	if (cacheId && conduitValidated) {
		return cacheId;
	}

	console.debug("Validating conduit...");

	type ConduitData = {
		data: { id: string; shard_count: number; }[];
	};
	const checkConduitResponse = await sb.Got.get("GenericAPI")<ConduitData>({
		url: "https://api.twitch.tv/helix/eventsub/conduits",
		method: "GET",
		responseType: "json",
		throwHttpErrors: false,
		headers: {
			Authorization: `Bearer ${appToken}`,
			"Client-Id": env.TWITCH_CLIENT_ID
		}
	});

	if (checkConduitResponse.ok) {
		const conduitIdList = checkConduitResponse.body.data.map(i => i.id);
		if (conduitIdList.length === 0) {
			console.debug("No valid conduits found");
		}
		else if (conduitIdList.length === 1) {
			console.debug("Exactly one valid conduit found, all good!");

			conduitValidated = true;
			await sb.Cache.setByPrefix(CONDUIT_ID_KEY, conduitIdList[0]);
			return conduitIdList[0];
		}
		else {
			console.debug("Multiple conduits found, removing to avoid conflict...");

			for (const id of conduitIdList) {
				await sb.Got.get("GenericAPI")({
					url: "https://api.twitch.tv/helix/eventsub/conduits",
					method: "DELETE",
					responseType: "json",
					throwHttpErrors: false,
					headers: {
						Authorization: `Bearer ${appToken}`,
						"Client-Id": env.TWITCH_CLIENT_ID
					},
					searchParams: { id }
				});

				console.debug(`Deleted conduit id ${id}`);
			}

			console.debug("Clearing subscription cache...");
			await sb.Cache.setByPrefix(SUBSCRIPTIONS_CACHE_KEY, null);
		}
	}
	else {
		console.log("Could not check for conduit validity", checkConduitResponse.body);
	}

	console.debug("Re-making conduit...");

	const response = await sb.Got.get("GenericAPI")<ConduitData>({
		url: "https://api.twitch.tv/helix/eventsub/conduits",
		method: "POST",
		responseType: "json",
		throwHttpErrors: false,
		headers: {
			Authorization: `Bearer ${appToken}`,
			"Client-Id": env.TWITCH_CLIENT_ID
		},
		json: { shard_count: 1 }
	});

	if (!response.ok) {
		throw new sb.Error({
			message: "Could not obtain conduit id",
			args: {
				body: response.body,
				statusCode: response.statusCode
			}
		});
	}

	console.debug("Conduit set up successfully!");

	const [shard] = response.body.data;
	await sb.Cache.setByPrefix(CONDUIT_ID_KEY, shard.id);
	conduitValidated = true;

	return shard.id;
};

const assignWebsocketToConduit = async (sessionId: string): Promise<void> => {
	const conduitId = await getConduitId();
	const appToken = await getAppAccessToken();

	type ShardAssignmentData = {
		data: {
			id: string;
			status: string;
			transport: { method: string; callback: string; };
		}[];
	};
	const response = await sb.Got.get("GenericAPI")<ShardAssignmentData>({
		method: "PATCH",
		url: "https://api.twitch.tv/helix/eventsub/conduits/shards",
		responseType: "json",
		throwHttpErrors: false,
		headers: {
			Authorization: `Bearer ${appToken}`,
			"Client-Id": env.TWITCH_CLIENT_ID
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
			args: { body: response.body }
		});
	}
};

type CreateSubscriptionData = {
	subscription: string;
	condition?: string | { to_broadcaster_user_id: string; };
	version: string;
	selfId?: string;
	channelId?: string;
};
type CreateSubscriptionResponse = {
	data: Subscription[];
	total: number;
	total_cost: number;
	max_total_cost: number;
};
type ListSubscriptionsResponse = CreateSubscriptionResponse & {
	pagination: { cursor?: string; };
};

const createSubscription = async (data: CreateSubscriptionData) => {
	const conduitId = await getConduitId();
	const appToken = await getAppAccessToken();

	const {
		subscription,
		condition: customCondition,
		version,
		selfId,
		channelId
	} = data;

	let condition: SubscriptionCondition;
	if (customCondition) {
		condition = customCondition;
	}
	else if (!channelId && typeof selfId === "string") {
		condition = { user_id: selfId };
	}
	else if (!selfId && typeof channelId === "string") {
		condition = { broadcaster_user_id: channelId };
	}
	else if (typeof selfId === "string" && typeof channelId === "string") {
		condition = {
			user_id: selfId,
			broadcaster_user_id: channelId
		};
	}
	else {
		throw new SupiError({
			message: "Invalid combination of arguments"
		})
	}

	const response = await sb.Got.get("GenericAPI")<CreateSubscriptionResponse>({
		url: "https://api.twitch.tv/helix/eventsub/subscriptions",
		method: "POST",
		responseType: "json",
		throwHttpErrors: false,
		headers: {
			Authorization: `Bearer ${appToken}`,
			"Client-Id": env.TWITCH_CLIENT_ID
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

const createChannelChatMessageSubscription = async (selfId: string, channelId: string, platform: TwitchPlatform) => {
	const { response } = await createSubscription({
		channelId,
		selfId,
		subscription: "channel.chat.message",
		version: "1"
	});

	if (response.statusCode === 403) {
		const channelData = sb.Channel.getBySpecificId(channelId, platform);
		if (channelData) {
			await Promise.all([
				channelData.saveProperty("Mode", "Inactive"),
				channelData.setDataProperty("twitchNoScopeDisabled", true)
			]);
		}
	}

	return { response };
};

const createWhisperMessageSubscription = (selfId: string) => createSubscription({
	selfId,
	subscription: "user.whisper.message",
	version: "1"
});

const createChannelSubSubscription = (channelId: string) => createSubscription({
	channelId,
	subscription: "channel.subscribe",
	version: "1"
});

const createChannelResubSubscription = (channelId: string) => createSubscription({
	channelId,
	subscription: "channel.subscription.message",
	version: "1"
});

const createChannelRaidSubscription = (channelId: string) => createSubscription({
	condition: {
		to_broadcaster_user_id: channelId
	},
	subscription: "channel.raid",
	version: "1"
});

const createChannelOnlineSubscription = (channelId: string) => createSubscription({
	channelId,
	subscription: "stream.online",
	version: "1"
});

const createChannelOfflineSubscription = (channelId: string) => createSubscription({
	channelId,
	subscription: "stream.offline",
	version: "1"
});

const createChannelRedemptionSubscription = (channelId: string) => createSubscription({
	channelId,
	subscription: "channel.channel_points_custom_reward_redemption.add",
	version: "1"
});

const fetchExistingSubscriptions = async (): Promise<Subscription[]> => {
	const accessToken = await getAppAccessToken();
	const response = await sb.Got.get("GenericAPI")<ListSubscriptionsResponse>({
		url: "https://api.twitch.tv/helix/eventsub/subscriptions",
		method: "GET",
		responseType: "json",
		throwHttpErrors: false,
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Client-Id": env.TWITCH_CLIENT_ID
		},
		searchParams: {
			status: "enabled"
		}
	});

	const result: Subscription[] = [...response.body.data];
	let cursor: string | null = response.body.pagination?.cursor ?? null;
	while (cursor) {
		const loopResponse = await sb.Got.get("GenericAPI")<ListSubscriptionsResponse>({
			url: "https://api.twitch.tv/helix/eventsub/subscriptions",
			method: "GET",
			responseType: "json",
			throwHttpErrors: false,
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Client-Id": env.TWITCH_CLIENT_ID
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

const getExistingSubscriptions = async (force = false): Promise<Subscription[]> => {
	if (!force) {
		const cacheData = await sb.Cache.getByPrefix(SUBSCRIPTIONS_CACHE_KEY) as Subscription[] | undefined;
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

const fetchToken = async () => {
	const refreshToken = (await sb.Cache.getByPrefix("TWITCH_REFRESH_TOKEN") as string | undefined)
		?? env.TWITCH_REFRESH_TOKEN;

	if (!refreshToken) {
		throw new sb.Error({
			message: "No Twitch refresh token has been configured (TWITCH_REFRESH_TOKEN)"
		});
	}

	const response = await sb.Got.get("GenericAPI")<AccessTokenData>({
		url: "https://id.twitch.tv/oauth2/token",
		method: "POST",
		searchParams: {
			grant_type: "refresh_token",
			refresh_token: refreshToken,
			client_id: env.TWITCH_CLIENT_ID,
			client_secret: env.TWITCH_CLIENT_SECRET
		}
	});

	await Promise.all([
		sb.Cache.setByPrefix("TWITCH_REFRESH_TOKEN", response.body.refresh_token),
		sb.Cache.setByPrefix("TWITCH_OAUTH", response.body.access_token, {
			// Reduce expiration time by 10 seconds to allow for latency
			expiry: (response.body.expires_in * 1000) - 10_000
		})
	]);

	return response.body.access_token;
};

type MessageData = MessageSubscriptionData["payload"]["event"]["message"];
const emitRawUserMessageEvent = (username: string, channelName: string, platform: TwitchPlatform, message: MessageData) => {
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

	const channelData = sb.Channel.get(channelName, platform);
	if (channelData) {
		channelData.events.emit("message", {
			event: "message",
			message: message.text,
			user: null,
			channel: channelData,
			platform,
			raw: {
				user: username
			},
			messageData: message
		});
	}
};

const populateUserChannelActivity = async (userData: User, channelData: Channel) => {
	const key = `${USER_CHANNEL_ACTIVITY_PREFIX}-${channelData.ID}-${userData.Name}`;
	await sb.Cache.setByPrefix(key, "1", {
		expiry: 36e5 // 60 minutes
	});
};

const getActiveUsernamesInChannel = async (channelData: Channel) => {
	const prefix = `${USER_CHANNEL_ACTIVITY_PREFIX}-${channelData.ID}-`;
	const prefixes = await sb.Cache.getKeysByPrefix(`${prefix}*`, {});

	return prefixes.map(i => i.replace(prefix, ""));
};

const initTokenCheckInterval = async () => {
	const tokenExists = await sb.Cache.getByPrefix("TWITCH_OAUTH");
	if (!tokenExists) {
		await fetchToken();
	}

	setInterval(async () => await fetchToken(), TOKEN_REGENERATE_INTERVAL);
};

const initSubCacheCheckInterval = () => {
	setInterval(async () => await getExistingSubscriptions(true), SUBSCRIPTIONS_CACHE_INTERVAL / 2);
};

const sanitizeMessage = (string: string) => string.replace(/^\u0001ACTION (.+)\u0001$/, "$1");

export default {
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
	createChannelRedemptionSubscription,
	fetchToken,
	emitRawUserMessageEvent,
	getActiveUsernamesInChannel,
	populateUserChannelActivity,
	initTokenCheckInterval,
	initSubCacheCheckInterval,
	sanitizeMessage
};
