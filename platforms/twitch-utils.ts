import { SupiError } from "supi-core";

import type { TwitchPlatform } from "./twitch.js";
import type { User } from "../classes/user.js";
import type { Channel } from "../classes/channel.js";

const { env } = globalThis.process;

const APP_ACCESS_CACHE_KEY = "twitch-app-access-token";
const CONDUIT_ID_KEY = "twitch-conduit-id";
const USER_CHANNEL_ACTIVITY_PREFIX = "twitch-user-activity-";
const SUBSCRIPTIONS_CACHE_KEY = "twitch-subscriptions";
const SUBSCRIPTIONS_CACHE_EXPIRY = 120 * 60_000; // 60 minutes
const SUBSCRIPTIONS_CACHE_INTERVAL = 30 * 60_000; // 30 minutes, 1/4 of sub cache expiry
const TOKEN_REGENERATE_INTERVAL = 60 * 60_000; // 60 minutes

export type SubscriptionCondition = string
	| { user_id: string; }
	| { broadcaster_user_id: string; }
	| { to_broadcaster_user_id: string; }
	| { user_id: string; broadcaster_user_id: string; };

export type Subscription = {
	id: string;
	status: string;
	type: string;
	version: string;
	cost: number;
	condition: SubscriptionCondition;
	created_at: string;
	transport: { method: string; callback: string; };
};
export type EnabledSubscription = Subscription & {
	status: "enabled";
};
export type RevokedSubscription = Subscription & {
	status: "user_removed" | "authorization_revoked" | "version_removed";
}
export type SubscriptionTier = "1000" | "2000" | "3000" | "Prime";

export interface BaseWebsocketMessage {
	metadata: {
		message_id: string;
		message_type: string;
		message_timestamp: string;
	};
	payload: Record<string, unknown>;
}
export interface SessionWelcomeMessage extends BaseWebsocketMessage {
	metadata: {
		message_id: string;
		message_type: "session_welcome";
		message_timestamp: string;
	}
	payload: {
		session: {
			id: string;
			status: string;
			connected_at: string;
			keepalive_timeout_seconds: number;
			reconnect_url: null;
		};
	};
}
export interface SessionKeepaliveMessage extends BaseWebsocketMessage {
	metadata: {
		message_id: string;
		message_type: "session_keepalive";
		message_timestamp: string;
	};
	payload: Record<string, never>;
}
export interface SessionReconnectMessage extends BaseWebsocketMessage {
	metadata: {
		message_id: string;
		message_type: "session_reconnect";
		message_timestamp: string;
	};
	payload: {
		session: {
			id: string;
			status: string;
			connected_at: string;
			keepalive_timeout_seconds: number;
			reconnect_url: string;
		}
	};
}
export interface RevocationMessage extends BaseWebsocketMessage {
	metadata: {
		message_id: string;
		message_type: "revocation";
		message_timestamp: string;
		subscription_type: string;
		subscription_verison: string;
	};
	payload: {
		subscription: RevokedSubscription;
	};
}
export interface NotificationMessage extends BaseWebsocketMessage {
	metadata: {
		message_id: string;
		message_type: "notification";
		message_timestamp: string;
		subscription_type: string;
		subscription_verison: string;
	};
	payload: {
		subscription: EnabledSubscription;
		event: Record<string, unknown>;
	};
}

export type TwitchWebsocketMessage =
	| SessionWelcomeMessage
	| SessionKeepaliveMessage
	| SessionReconnectMessage
	| RevocationMessage
	| NotificationMessage;

export const isWelcomeMessage = (input: TwitchWebsocketMessage): input is SessionWelcomeMessage => (input.metadata.message_type === "session_welcome");
export const isReconnectMessage = (input: TwitchWebsocketMessage): input is SessionReconnectMessage => (input.metadata.message_type === "session_reconnect");
export const isKeepaliveMessage = (input: TwitchWebsocketMessage): input is SessionKeepaliveMessage => (input.metadata.message_type === "session_keepalive");
export const isRevocationMessage = (input: TwitchWebsocketMessage): input is RevocationMessage => (input.metadata.message_type === "revocation");
export const isNotificationMessage = (input: TwitchWebsocketMessage): input is NotificationMessage => (input.metadata.message_type === "notification");

export type MessageBadge = {
	set_id: string;
	id: string;
	info: string;
};
export interface MessageNotification extends NotificationMessage {
	payload: {
		subscription: NotificationMessage["payload"]["subscription"] & {
			type: "channel.chat.message";
			condition: {
				user_id: string;
				broadcaster_user_id: string;
			},
		};
		event: {
			badges: MessageBadge[];
			broadcaster_user_id: string;
			broadcaster_user_login: string;
			broadcaster_user_name: string;
			channel_points_animation_id: string | null;
			channel_points_custom_reward_id: string | null;
			chatter_user_id: string;
			chatter_user_login: string;
			chatter_user_name: string;
			cheer: {
				bits: number;
			} | null;
			color: string;
			message: {
				fragments: {
					type: "text" | "cheermote" | "emote" | "mention";
					text: string;
					cheermote: {
						prefix: string;
						bits: number;
						tier: number;
					} | null;
					emote: {
						id: string;
						emote_set_id: string;
						owner_id: string;
						format: ("animated" | "static")[];
					} | null;
					mention: {
						user_id: string;
						user_name: string;
						user_login: string;
					} | null;
				}[];
				text: string;
			};
			message_id: string;
			message_type: "text" | "channel_points_highlighted" | "channel_points_sub_only"
				| "user_intro" | "power_ups_message_effect" | "power_ups_gigantified_emote";
			reply: {
				parent_message_id: string;
				parent_message_body: string;
				parent_user_id: string;
				parent_user_name: string;
				parent_user_login: string;
				thread_message_id: string;
				thread_user_id: string;
				thread_user_name: string;
				thread_user_login: string;
			} | null;
			source_badges: MessageBadge[] | null;
			source_broadcaster_user_id: string | null;
			source_broadcaster_user_name: string | null;
			source_broadcaster_user_login: string | null;
			source_message_id: string | null;
		};
	}
}
export interface WhisperNotification extends NotificationMessage {
	payload: {
		subscription: NotificationMessage["payload"]["subscription"] & {
			type: "user.whisper.message";
			condition: {
				user_id: string;
			},
		};
		event: {
			from_user_id: string;
			from_user_login: string;
			from_user_name: string;
			to_user_id: string;
			to_user_login: string;
			to_user_name: string;
			whisper_id: string;
			whisper: { text: string; }
		};
	}
}
export interface SubscribeMessageNotification extends NotificationMessage {
	payload: {
		subscription: NotificationMessage["payload"]["subscription"] & {
			type: "channel.subscription.message";
			condition: {
				broadcaster_user_id: string;
			},
		};
		event: {
			user_id: string;
			user_login: string;
			user_name: string;
			broadcaster_user_id: string;
			broadcaster_user_login: string;
			broadcaster_user_name: string;
			tier: SubscriptionTier;
			message: {
				text: string;
				emotes: {
					begin: number;
					end: number;
					id: string;
				}[];
			};
			cumulative_months: number;
			streak_months: number | null;
			duration_months: number;
		};
	}
}
export interface RaidNotification extends NotificationMessage {
	payload: {
		subscription: NotificationMessage["payload"]["subscription"] & {
			type: "channel.raid";
			condition: {
				to_broadcaster_user_id: string;
			},
		};
		event: {
			from_broadcaster_user_id: string;
			from_broadcaster_user_login: string;
			from_broadcaster_user_name: string;
			to_broadcaster_user_id: string;
			to_broadcaster_user_login: string;
			to_broadcaster_user_name: string;
			viewers: number;
		};
	};
}
export interface StreamOnlineNotification extends NotificationMessage {
	payload: {
		subscription: NotificationMessage["payload"]["subscription"] & {
			type: "stream.online";
			condition: {
				broadcaster_user_id: string;
			},
		};
		event: {
			id: string;
			broadcaster_user_id: string;
			broadcaster_user_login: string;
			broadcaster_user_name: string;
			started_at: string;
			type: "live" | "playlist" | "watch_party" | "premiere" | "rerun";
		};
	};
}
export interface StreamOfflineNotification extends NotificationMessage {
	payload: {
		subscription: NotificationMessage["payload"]["subscription"] & {
			type: "stream.offline";
			condition: {
				broadcaster_user_id: string;
			},
		};
		event: {
			broadcaster_user_id: string;
			broadcaster_user_login: string;
			broadcaster_user_name: string;
		};
	};
}

export const isMessageNotification = (input: NotificationMessage): input is MessageNotification => (input.payload.subscription.type === "channel.chat.message");
export const isWhisperNotification = (input: NotificationMessage): input is WhisperNotification => (input.payload.subscription.type === "user.whisper.message");
export const isSubscribeNotification = (input: NotificationMessage): input is SubscribeMessageNotification => (input.payload.subscription.type === "channel.subscription.message");
export const isRaidNotification = (input: NotificationMessage): input is RaidNotification => (input.payload.subscription.type === "channel.raid");
export const isStreamChangeNotification = (input: NotificationMessage): input is StreamOnlineNotification | StreamOfflineNotification => (
	input.payload.subscription.type === "stream.offline" || input.payload.subscription.type === "stream.online"
);

type AccessTokenData = {
	access_token: string;
	refresh_token: string;
	expires_in: number;
	scope: string | string[];
	token_type: string;
};

const getAppAccessToken = async (): Promise<string> => {
	const cacheToken = await core.Cache.getByPrefix(APP_ACCESS_CACHE_KEY) as string | undefined;
	if (cacheToken) {
		return cacheToken;
	}

	const response = await core.Got.get("GenericAPI")<AccessTokenData>({
		url: "https://id.twitch.tv/oauth2/token",
		method: "POST",
		searchParams: {
			grant_type: "client_credentials",
			client_id: env.TWITCH_CLIENT_ID,
			client_secret: env.TWITCH_CLIENT_SECRET
		}
	});

	if (!response.ok) {
		throw new SupiError({
			message: "Could not fetch app access token!",
			args: { body: response.body }
		});
	}

	const token = response.body.access_token;
	await core.Cache.setByPrefix(APP_ACCESS_CACHE_KEY, token, {
		expiry: (response.body.expires_in * 1000)
	});

	return token;
};

let conduitValidated = false;
const getConduitId = async (): Promise<string> => {
	const appToken = await getAppAccessToken();
	const cacheId = await core.Cache.getByPrefix(CONDUIT_ID_KEY) as string | undefined;
	if (cacheId && conduitValidated) {
		return cacheId;
	}

	console.debug("Validating conduit...");

	type ConduitData = {
		data: { id: string; shard_count: number; }[];
	};
	const checkConduitResponse = await core.Got.get("GenericAPI")<ConduitData>({
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
			await core.Cache.setByPrefix(CONDUIT_ID_KEY, conduitIdList[0]);
			return conduitIdList[0];
		}
		else {
			console.debug("Multiple conduits found, removing to avoid conflict...");

			for (const id of conduitIdList) {
				await core.Got.get("GenericAPI")({
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
			await core.Cache.setByPrefix(SUBSCRIPTIONS_CACHE_KEY, null);
		}
	}
	else {
		console.log("Could not check for conduit validity", checkConduitResponse.body);
	}

	console.debug("Re-making conduit...");

	const response = await core.Got.get("GenericAPI")<ConduitData>({
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
		throw new SupiError({
			message: "Could not obtain conduit id",
			args: {
				body: response.body,
				statusCode: response.statusCode
			}
		});
	}

	console.debug("Conduit set up successfully!");

	const [shard] = response.body.data;
	await core.Cache.setByPrefix(CONDUIT_ID_KEY, shard.id);
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
	const response = await core.Got.get("GenericAPI")<ShardAssignmentData>({
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
		throw new SupiError({
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
	data: EnabledSubscription[];
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
		});
	}

	const response = await core.Got.get("GenericAPI")<CreateSubscriptionResponse>({
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

const fetchExistingSubscriptions = async (): Promise<EnabledSubscription[]> => {
	const accessToken = await getAppAccessToken();
	const response = await core.Got.get("GenericAPI")<ListSubscriptionsResponse>({
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

	const result: EnabledSubscription[] = [...response.body.data];
	let cursor: string | null = response.body.pagination.cursor ?? null;
	while (cursor) {
		const loopResponse = await core.Got.get("GenericAPI")<ListSubscriptionsResponse>({
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
		cursor = loopResponse.body.pagination.cursor ?? null;
	}

	return result;
};

const getExistingSubscriptions = async (force = false): Promise<EnabledSubscription[]> => {
	if (!force) {
		const cacheData = await core.Cache.getByPrefix(SUBSCRIPTIONS_CACHE_KEY) as EnabledSubscription[] | undefined;
		if (cacheData) {
			return cacheData;
		}
	}

	const subscriptions = await fetchExistingSubscriptions();
	await core.Cache.setByPrefix(SUBSCRIPTIONS_CACHE_KEY, subscriptions, {
		expiry: SUBSCRIPTIONS_CACHE_EXPIRY
	});

	return subscriptions;
};

const fetchToken = async () => {
	const refreshToken = (await core.Cache.getByPrefix("TWITCH_REFRESH_TOKEN") as string | undefined)
		?? env.TWITCH_REFRESH_TOKEN;

	if (!refreshToken) {
		throw new SupiError({
			message: "No Twitch refresh token has been configured (TWITCH_REFRESH_TOKEN)"
		});
	}

	const response = await core.Got.get("GenericAPI")<AccessTokenData>({
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
		core.Cache.setByPrefix("TWITCH_REFRESH_TOKEN", response.body.refresh_token),
		core.Cache.setByPrefix("TWITCH_OAUTH", response.body.access_token, {
			// Reduce expiration time by 10 seconds to allow for latency
			expiry: (response.body.expires_in * 1000) - 10_000
		})
	]);

	return response.body.access_token;
};

type MessageData = MessageNotification["payload"]["event"]["message"];
const emitRawUserMessageEvent = (username: string, userId: string, channelName: string, platform: TwitchPlatform, message: MessageData) => {
	if (!username || !channelName) {
		throw new SupiError({
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
			messageData: message,
			raw: {
				user: username,
				userId
			}
		});
	}
};

const populateUserChannelActivity = async (userData: User, channelData: Channel) => {
	const key = `${USER_CHANNEL_ACTIVITY_PREFIX}-${channelData.ID}-${userData.Name}`;
	await core.Cache.setByPrefix(key, "1", {
		expiry: 36e5 // 60 minutes
	});
};

const getActiveUsernamesInChannel = async (channelData: Channel) => {
	const prefix = `${USER_CHANNEL_ACTIVITY_PREFIX}-${channelData.ID}-`;
	const prefixes = await core.Cache.getKeysByPrefix(`${prefix}*`, {});

	return prefixes.map(i => i.replace(prefix, ""));
};

const initTokenCheckInterval = async () => {
	const tokenExists = await core.Cache.getByPrefix("TWITCH_OAUTH");
	if (!tokenExists) {
		await fetchToken();
	}

	setInterval(() => void fetchToken(), TOKEN_REGENERATE_INTERVAL);
};

const initSubCacheCheckInterval = () => {
	setInterval(() => void getExistingSubscriptions(true), SUBSCRIPTIONS_CACHE_INTERVAL / 2);
};

const sanitizeMessage = (string: string) => string.replace(/^\u0001ACTION (.+)\u0001$/, "$1");

const ensureInitialChannelId = async (platform: TwitchPlatform) => {
	const initialChannel = process.env.INITIAL_TWITCH_CHANNEL;
	if (!initialChannel) {
		return;
	}

	const channelData = sb.Channel.get(initialChannel, platform);
	if (!channelData || channelData.Specific_ID) {
		return;
	}

	const channelId = await platform.getUserID(initialChannel);
	if (!channelId) {
		return;
	}

	await channelData.saveProperty("Specific_ID", channelId);
};

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
	sanitizeMessage,
	ensureInitialChannelId
};
