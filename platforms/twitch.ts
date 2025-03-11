import WebSocket, { RawData as WebsocketRawData } from "ws";
import { randomBytes } from "node:crypto";

import { Platform, BaseConfig } from "./template.js";
import cacheKeys from "../utils/shared-cache-keys.json" with { type: "json" };

import TwitchUtils from "./twitch-utils.js";
import { Channel } from "../classes/channel.js";
import { User } from "../classes/user.js";
import { Emote } from "../@types/globals.js";
import { SupiDate, SupiError } from "supi-core";

// Reference: https://github.com/SevenTV/API/blob/master/data/model/emote.model.go#L68
// Flag name: EmoteFlagsZeroWidth
// eslint-disable-next-line no-bitwise
const SEVEN_TV_ZERO_WIDTH_FLAG = (1 << 8);

const { TWITCH_ADMIN_SUBSCRIBER_LIST } = cacheKeys;
const FALLBACK_WHISPER_MESSAGE_LIMIT = 2500;
const WRITE_MODE_MESSAGE_DELAY = 1500;
const NO_EVENT_RECONNECT_TIMEOUT = 10000; // @todo move to config
const LIVE_STREAMS_KEY = "twitch-live-streams";
const TWITCH_WEBSOCKET_URL = "wss://eventsub.wss.twitch.tv/ws";
const MESSAGE_MODERATION_CODES = new Set(["channel_settings", "automod_held"]);

const BAD_MESSAGE_RESPONSE = "A message that was about to be posted violated this channel's moderation settings.";
const PRIVATE_COMMAND_FILTERED_RESPONSE = "That command is not available via private messages.";
const PRIVATE_COMMAND_UNRELATED_RESPONSE = "No valid command provided!";
const PRIVATE_COMMAND_NO_COMMAND_RESPONSE = "That command does not exist.";

const DEFAULT_LOGGING_CONFIG = {
	bits: false,
	messages: true,
	subs: false,
	timeouts: false,
	whispers: true,
	hosts: false
} as const;
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
	reconnectAnnouncement: null,
	emitLiveEventsOnlyForFlaggedChannels: false,
	suspended: false,
	joinChannelsOverride: [],
	spamPreventionThreshold: 100,
	sendVerificationChallenge: false,
	whisperMessageLimit: 500,
	unrelatedPrivateMessageResponse: ""
} as const;

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
type EnabledSubscription = Subscription & {
	status: "enabled";
};
type RevokedSubscription = Subscription & {
	status: "user_removed" | "authorization_revoked" | "version_removed";
}

interface BaseWebsocketMessage {
	metadata: {
		message_id: string;
		message_type: string;
		message_timestamp: string;
	};
	payload: Record<string, unknown>;
}
interface SessionWelcomeMessage extends BaseWebsocketMessage {
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
interface SessionKeepaliveMessage extends BaseWebsocketMessage {
	metadata: {
		message_id: string;
		message_type: "session_keepalive";
		message_timestamp: string;
	};
	payload: {};
}
interface SessionReconnectMessage extends BaseWebsocketMessage {
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
interface RevocationMessage extends BaseWebsocketMessage {
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
interface NotificationMessage extends BaseWebsocketMessage {
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

const isWelcomeMessage = (input: TwitchWebsocketMessage): input is SessionWelcomeMessage => (input.metadata.message_type === "session_welcome");
const isReconnectMessage = (input: TwitchWebsocketMessage): input is SessionReconnectMessage => (input.metadata.message_type === "session_reconnect");
const isRevocationMessage = (input: TwitchWebsocketMessage): input is RevocationMessage => (input.metadata.message_type === "revocation");
const isNotificationMessage = (input: TwitchWebsocketMessage): input is NotificationMessage => (input.metadata.message_type === "notification");

type TwitchWebsocketMessage =
	| SessionWelcomeMessage
	| SessionKeepaliveMessage
	| SessionReconnectMessage
	| RevocationMessage
	| NotificationMessage;

type MessageBadge = {
	set_id: string;
	id: string;
	info: string;
};
interface MessageNotification extends NotificationMessage {
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
interface WhisperNotification extends NotificationMessage {
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
interface SubscribeMessageNotification extends NotificationMessage {
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
			tier: string;
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
interface RaidNotification extends NotificationMessage {
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
interface StreamOnlineNotification extends NotificationMessage {
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
interface StreamOfflineNotification extends NotificationMessage {
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

const isMessageNotification = (input: NotificationMessage): input is MessageNotification => (input.payload.subscription.type === "channel.chat.message");
const isWhisperNotification = (input: NotificationMessage): input is WhisperNotification => (input.payload.subscription.type === "user.whisper.message");
const isSubscribeNotification = (input: NotificationMessage): input is SubscribeMessageNotification => (input.payload.subscription.type === "channel.subscription.message");
const isRaidNotification = (input: NotificationMessage): input is RaidNotification => (input.payload.subscription.type === "channel.raid");
const isStreamChangeNotification = (input: NotificationMessage): input is StreamOnlineNotification | StreamOfflineNotification => (
	input.payload.subscription.type === "stream.offline" || input.payload.subscription.type === "stream.online"
);

type ExtractEvent<T extends NotificationMessage> = T["payload"]["event"];

class ConfigurableWebsocket {
	private instance: WebSocket | null = null;
	connect (url: string) {
		this.instance = new WebSocket(url);
	}
}

type ConnectOptions = {
	url?: string;
	skipSubscriptions?: boolean;
};

interface TwitchConfig extends BaseConfig {
	selfId: string;
	logging: {
		bits?: boolean,
		messages?: boolean,
		subs?: boolean,
		timeouts?: boolean,
		whispers?: boolean
		hosts?: boolean;
	};
	platform: {
		modes?: Record<"Write" | "VIP" | "Moderator", {
			queueSize?: number;
			cooldown?: number;
		}>;
		reconnectAnnouncement?: {
			channels: string[];
			string: string;
		} | null;
		subscriptionPlans?: Record<string, string>;
		partChannelsOnPermaban?: boolean;
		clearRecentBansTimer?: number;
		recentBanThreshold?: number | null;
		updateAvailableBotEmotes?: boolean;
		ignoredUserNotices?: readonly string[];
		sameMessageEvasionCharacter?: string;
		rateLimits?: "default" | "knownBot" | "verifiedBot",
		emitLiveEventsOnlyForFlaggedChannels?: boolean;
		suspended?: boolean;
		joinChannelsOverride?: readonly string[];
		spamPreventionThreshold?: number;
		sendVerificationChallenge?: boolean;
		recentBanPartTimeout?: number;
		trackChannelsLiveStatus?: boolean;
		whisperMessageLimit?: number;
		privateMessageResponseFiltered?: string;
		privateMessageResponseNoCommand?: string;
		privateMessageResponseUnrelated?: string;
	};
}

export class TwitchPlatform extends Platform<TwitchConfig> {
	supportsMeAction = true;
	dynamicChannelAddition = true;

	// eslint-disable-next-line no-unused-private-class-members
	#reconnectCheck = setInterval(() => this.#pingWebsocket(), 30_000);
	#websocketLatency: number | null = null;
	#previousMessageMeta = new Map();
	#userCommandSpamPrevention = new Map();
	#unsuccessfulRenameChannels = new Set();

	debug = TwitchUtils;
	client: WebSocket | null = null;

	constructor (config: TwitchConfig) {
		const resultConfig = {
			...config,
			platform: {
				...DEFAULT_PLATFORM_CONFIG,
				...config.platform
			},
			logging: {
				...DEFAULT_LOGGING_CONFIG,
				...config.logging
			}
		};

		super("twitch", resultConfig);
	}

	async connect (options: ConnectOptions = {}) {
		if (!this.selfName) {
			throw new SupiError({
				message: "Twitch platform does not have the bot's name configured"
			});
		}
		else if (!process.env.TWITCH_CLIENT_ID) {
			throw new SupiError({
				message: "Twitch client ID has not been configured"
			});
		}
		else if (!process.env.TWITCH_CLIENT_SECRET) {
			throw new SupiError({
				message: "Twitch client secret has not been configured"
			});
		}

		await TwitchUtils.initTokenCheckInterval();
		await TwitchUtils.getAppAccessToken();
		await TwitchUtils.getConduitId();

		const ws = new WebSocket(options.url ?? TWITCH_WEBSOCKET_URL);
		ws.on("message", (data) => this.handleWebsocketMessage(data));

		this.client = ws;

		if (!options.skipSubscriptions) {
			const existingSubs = await TwitchUtils.getExistingSubscriptions(false);

			const existingWhisperSub = existingSubs.some(i => i.type === "user.whisper.message");
			if (!existingWhisperSub) {
				await TwitchUtils.createWhisperMessageSubscription(this.selfId);
			}

			const existingChannels = existingSubs.filter(i => i.type === "channel.chat.message");
			const existingIds = new Set(existingChannels.map(i => i.condition.broadcaster_user_id));

			const channelList = sb.Channel.getJoinableForPlatform(this);
			const missingChannels = channelList.filter(i => !existingIds.has(i.Specific_ID));

			const batchSize = 100;
			for (let index = 0; index < missingChannels.length; index += batchSize) {
				const slice = missingChannels.slice(index, index + batchSize);
				const joinPromises = slice.map(async channel => {
					if (!channel.Specific_ID) {
						return;
					}

					await this.joinChannel(channel.Specific_ID)
				});

				await Promise.allSettled(joinPromises);
			}
		}

		TwitchUtils.initSubCacheCheckInterval();

		const { channels, string } = this.config.reconnectAnnouncement ?? {};
		if (channels && string) {
			for (const channel of channels) {
				const channelData = sb.Channel.get(channel);
				if (channelData) {
					await channelData.send(string);
				}
			}
		}
	}

	async handleWebsocketMessage (data: WebsocketRawData) {
		const message: TwitchWebsocketMessage = JSON.parse(data.toString());

		if (isWelcomeMessage(message)) {
			const sessionId = message.payload.session.id;
			await TwitchUtils.assignWebsocketToConduit(sessionId);
		}
		else if (isReconnectMessage(message)) {
			await this.handleReconnect(message);
		}
		else if (isRevocationMessage(message)) {
			console.warn("Subscription revoked", { data });

			await sb.Logger.log(
				"Twitch.Warning",
				`Subscription revoked: ${JSON.stringify(data)}`,
				null,
				null
			);
		}
		else if (isNotificationMessage(message)) {
			await this.handleWebsocketNotification(message);
		}
		else {
			console.log("Unrecognized message", { message });
		}
	}

	async handleWebsocketNotification (data: NotificationMessage) {
		if (isMessageNotification(data)) {
			await this.handleMessage(data.payload.event);
		}
		else if (isWhisperNotification(data)) {
			await this.handlePrivateMessage(data.payload.event);
		}
		else if (isSubscribeNotification(data)) {
			await this.handleSub(data.payload.event);
		}
		else if (isRaidNotification(data)) {
			await this.handleRaid(data.payload.event);
		}
		else if (isStreamChangeNotification(data)) {
			await this.handleStreamLiveChange(data);
		}
		else {
			console.warn("Unrecognized notification", { data });
		}
	}

	async handleReconnect (event: SessionReconnectMessage) {
		const reconnectUrl = event.payload.session.reconnect_url;
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
	 * @param [options.meAction] If `true`, adds a ".me" at the start of the message to create a "me action".
	 * If not `true`, will escape all leading command characters (period "." or slash "/") by doubling them up.
	 */
	async send (message: string, channelData: Channel, options: { meAction?: boolean; } = {}) {
		if (channelData.Mode === "Inactive" || channelData.Mode === "Read") {
			return;
		}

		const baseMessage = message;
		message = message.replaceAll(/\s+/g, " ").trim();

		if (options.meAction === true) {
			message = `.me ${message}`;
		}
		else {
			message = message.replace(/^([./])/, "$1 $1");
		}

		// Neither the "same message" nor "global" cooldowns apply to VIP or Moderator channels
		if (channelData.Mode === "Write") {
			const now = SupiDate.now();
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

		const response = await sb.Got.get("Helix")({
			url: "chat/messages",
			method: "POST",
			throwHttpErrors: false,
			json: {
				broadcaster_id: channelData.Specific_ID,
				sender_id: this.selfId,
				message
				// reply_parent_message_id // could be useful in the future!
			},
			retry: {
				limit: 3,
				methods: ["POST"],
				calculateDelay: (retry) => {
					console.warn("HTTP retry failed!", retry.error);
					return retry.computedValue;
				},
				statusCodes: [500] // Retry when Helix returns 500 (currently unknown reasons?)
			}
		});

		if (!response.ok) {
			console.warn("HTTP not sent!", {
				status: response.statusCode,
				body: response.body,
				message,
				channel: channelData.Name,
				options
			});

			return;
		}

		const replyData = response.body.data[0];
		if (!replyData.is_sent) {
			console.warn("JSON not sent!", {
				time: new SupiDate().format("Y-m-d H:i:s"),
				channel: {
					ID: channelData.ID,
					Name: channelData.Name
				},
				message,
				replyData
			});

			if (MESSAGE_MODERATION_CODES.has(replyData.drop_reason.code) && baseMessage !== BAD_MESSAGE_RESPONSE) {
				await this.send(BAD_MESSAGE_RESPONSE, channelData);
			}
		}
		else {
			this.#previousMessageMeta.set(channelData.ID, {
				length: message.length,
				time: SupiDate.now()
			});
		}
	}

	async me (message: string, channel: Channel) {
		return await this.send(message, channel, { meAction: true });
	}

	async pm (message: string, userData: User) {
		const joinOverride = this.config.joinChannelsOverride ?? [];
		if (this.config.suspended || joinOverride.length !== 0) {
			return;
		}

		if (!userData.Twitch_ID) {
			// @todo API response type
			const response = await sb.Got.get("Helix")({
				url: "users",
				searchParams: {
					login: userData.Name
				}
			});

			const helixUserData = response.body?.data?.[0];
			if (!response.ok || !helixUserData) {
				throw new SupiError({
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
			.replaceAll(/[\r\n]/g, " ")
			.trim();

		const whisperMessageLimit = this.config.whisperMessageLimit ?? FALLBACK_WHISPER_MESSAGE_LIMIT;
		const response = await sb.Got.get("Helix")({
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

	async timeout (channelData: Channel, user: User | string, duration: number = 1, reason: string | null = null) {
		if (!channelData || !user) {
			throw new SupiError({
				message: "Missing user or channel",
				args: {
					channel: channelData.Name,
					user: (typeof user === "string") ? user : user.Name
				}
			});
		}
		else if (channelData.Platform !== this) {
			throw new SupiError({
				message: "Non-Twitch channel provided",
				args: { channel: channelData.Name }
			});
		}

		const channelID = channelData.Specific_ID ?? await this.getUserID(channelData.Name);
		if (!channelID) {
			throw new SupiError({
				message: "Invalid channel provided"
			});
		}

		const userID = (user instanceof sb.User) ? user.Twitch_ID : await this.getUserID(user);
		if (!userID) {
			throw new SupiError({
				message: "Invalid user provided",
				args: {
					user: (typeof user === "string") ? user : user.Name
				}
			});
		}

		// @todo add types for moderation Helix API
		const response = await sb.Got.get("Helix")({
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

	async handleMessage (event: ExtractEvent<MessageNotification>) {
		const {
			broadcaster_user_login: channelName,
			broadcaster_user_id: channelId,
			chatter_user_login: senderUsername,
			chatter_user_id: senderUserId,
			badges,
			color,
			channel_points_animation_id: animationId,
			channel_points_custom_reward_id: rewardId,
			cheer,
			reply
		} = event;

		const messageData = {
			text: TwitchUtils.sanitizeMessage(event.message.text),
			fragments: event.message.fragments,
			type: event.message_type,
			id: event.message_id,
			bits: cheer,
			badges,
			color,
			animationId,
			rewardId
		};

		const userData = await sb.User.get(senderUsername, false, { Twitch_ID: senderUserId });

		if (!userData) {
			TwitchUtils.emitRawUserMessageEvent(senderUsername, channelName, this, messageData);
			return;
		}
		else if (userData.Twitch_ID === null && userData.Discord_ID !== null) {
			if (!this.config.sendVerificationChallenge) {
				await userData.saveProperty("Twitch_ID", senderUserId);
			}
			else {
				if (!messageData.text.startsWith(sb.Command.prefix)) {
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

				await this.pm(message, userData);
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
				const notified = await userData.getDataProperty("twitch-userid-mismatch-notification") as boolean | undefined;
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
							await this.pm(replyMessage, userData);
						}
						else {
							await channelData.send(finalMessage);
						}
					}
					else {
						await this.pm(replyMessage, userData);
					}

					await Promise.all([
						sb.Logger.log("Twitch.Other", `Suspicious user: ${userData.Name} - ${userData.Twitch_ID}`, null, userData),
						userData.setDataProperty("twitch-userid-mismatch-notification", true)
					]);
				}
			}

			TwitchUtils.emitRawUserMessageEvent(senderUsername, channelName, this, messageData);

			return;
		}

		/** @type {Channel | null} */
		const channelData = sb.Channel.get(channelName, this) ?? sb.Channel.getBySpecificId(channelId, this);
		if (channelData && channelData.Name !== channelName && !this.#unsuccessfulRenameChannels.has(channelId)) {
			await this.fixChannelRename(channelData, channelName, channelId);
		}

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
			TwitchUtils.populateUserChannelActivity(userData, channelData)
		]);

		// Mirror messages to a linked channel, if the channel has one
		if (channelData.Mirror) {
			this.mirror(messageData.text, userData, channelData, { commandUsed: false });
		}

		this.incrementMessageMetric("read", channelData);

		// Own message - check the regular/vip/mod/broadcaster status, and skip
		if (channelData && senderUserId === this.selfId) {
			const flatBadges = new Set(badges.map(i => i.set_id));
			const oldMode = channelData.Mode;

			if (flatBadges.has("moderator") || flatBadges.has("broadcaster")) {
				channelData.Mode = "Moderator";
			}
			else if (flatBadges.has("vip")) {
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

		// If the handled message is a reply to another, append its content at the end.
		// This is so that a possible command execution can be handled with the reply's message as input..
		let targetMessage = messageData.text;
		if (reply) {
			// The original message starts with the thread author's username mention, so replace that first
			targetMessage = targetMessage
				.replace(/^@/, "")
				.replace(reply.parent_user_name, "")
				.trim();

			// Then append the original message body
			targetMessage += ` ${reply.parent_message_body}`;
		}

		if (!sb.Command.is(targetMessage)) {
			return;
		}

		const now = SupiDate.now();
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
	 */
	async handlePrivateMessage (event: ExtractEvent<WhisperNotification>) {
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
			const noCommandMessage = this.config.privateMessageResponseUnrelated ?? PRIVATE_COMMAND_UNRELATED_RESPONSE;
			await this.pm(noCommandMessage, userData);
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
				const filteredMessage = this.config.privateMessageResponseFiltered ?? PRIVATE_COMMAND_FILTERED_RESPONSE;
				await this.pm(filteredMessage, userData);
			}
			else if (result?.reason === "no-command") {
				const noCommandResponse = this.config.privateMessageResponseNoCommand ?? PRIVATE_COMMAND_NO_COMMAND_RESPONSE;
				await this.pm(noCommandResponse, userData);
			}
		}
	}

	async handleSub (event: ExtractEvent<SubscribeMessageNotification>) {
		const userData = await sb.User.get(event.user_login);
		const channelData = sb.Channel.get(event.broadcaster_user_login);
		if (!channelData) {
			return;
		}

		await sb.Logger.log("Twitch.Sub", JSON.stringify({ event }));
		const plans = this.config.subscriptionPlans;

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

	async handleRaid (event: ExtractEvent<RaidNotification>) {
		const {
			to_broadcaster_user_id: channelId,
			to_broadcaster_user_login: channelName,
			from_broadcaster_user_login: fromName
		} = event;

		const channelData = sb.Channel.get(channelName, this) ?? sb.Channel.getBySpecificId(channelId, this);
		if (!channelData || channelData.Mode === "Read" || channelData.Mode === "Inactive") {
			return;
		}

		channelData.events.emit("raid", {
			event: "raid",
			message: null,
			channel: channelData,
			username: fromName,
			platform: this,
			data: {
				viewers: event.viewers
			}
		});

		if (this.logging.hosts) {
			await sb.Logger.log("Twitch.Host", `Raid: ${fromName} => ${channelData.Name} for ${event.viewers} viewers`);
		}
	}

	async handleStreamLiveChange (event: StreamOnlineNotification | StreamOfflineNotification) {
		const { type } = event.payload.subscription;
		const {
			broadcaster_user_id: channelId,
			broadcaster_user_login: channelName
		} = event.payload.event;

		const channelData = sb.Channel.get(channelName, this) ?? sb.Channel.getBySpecificId(channelId, this);
		if (!channelData) {
			return;
		}

		if (type === "stream.online") {
			channelData.events.emit("online", {
				event: "online",
				channel: channelData
			});

			const existing = await this.getLiveChannelIdList();
			if (!existing.includes(channelId)) {
				await this.addLiveChannelIdList(channelId);
			}
		}
		else if (type === "stream.offline") {
			channelData.events.emit("offline", {
				event: "offline",
				channel: channelData
			});

			await this.removeLiveChannelIdList(channelId);
		}
	}

	async handleCommand (command: string, user: User, channel: Channel | null, args: string[] = [], options = {}) {
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

	async isUserChannelOwner (channelData: Channel, userData: User) {
		return (channelData.Specific_ID === userData.Twitch_ID);
	}

	async getUserID (user: string): Promise<string | null> {
		// @todo type: Helix User API
		const response = await sb.Got.get("Helix")({
			url: "users",
			throwHttpErrors: false,
			searchParams: {
				login: user
			}
		});

		if (!response.ok) {
			return null;
		}

		const { data } = response.body;
		if (data.length === 0) {
			return null;
		}

		return data[0].id;
	}

	async createUserMention (userData: User) {
		return `@${userData.Name}`;
	}

	/**
	 * Determines whether a user is subscribed to a given Twitch channel.
	 * @param {sb.User} userData
	 * @returns {Promise<boolean>}
	 */
	async fetchUserAdminSubscription (userData: User) {
		/** @type {Object[]|null} */
		const subscriberList = await sb.Cache.getByPrefix(TWITCH_ADMIN_SUBSCRIBER_LIST);
		if (!subscriberList || !Array.isArray(subscriberList)) {
			return false;
		}

		return subscriberList.some(i => i.user_id === userData.Twitch_ID);
	}

	async getLiveChannelIdList () {
		return await sb.Cache.server.lrange(LIVE_STREAMS_KEY, 0, -1);
	}

	async addLiveChannelIdList (channelId: string) {
		return await sb.Cache.server.lpush(LIVE_STREAMS_KEY, channelId);
	}

	async removeLiveChannelIdList (channelId: string) {
		return await sb.Cache.server.lrem(LIVE_STREAMS_KEY, 1, channelId);
	}

	async isChannelLive (channelData: Channel) {
		const channelId = channelData.Specific_ID;
		if (!channelId) {
			throw new SupiError({
				message: "Channel has no Twitch ID specified"
			});
		}

		const liveList = await this.getLiveChannelIdList();
		return (liveList.includes(channelId));
	}

	/**
	 * Fetches a list of emote data available to the bot user.
	 * @returns {Promise<TwitchEmoteSetDataObject[]>}
	 */
	static async fetchTwitchEmotes (selfId: string) {
		// @todo Helix API type
		const response = await sb.Got.get("Helix")({
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
				const pageResponse = await sb.Got.get("Helix")({
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

	static async fetchChannelBTTVEmotes (channelData: Channel): Promise<Emote[]> {
		const channelID = channelData.Specific_ID;
		if (!channelID) {
			throw new SupiError({
				message: "No available ID for channel",
				args: { channel: channelData.Name }
			});
		}

		// @todo BTTV API type
		const response = await sb.Got.get("TwitchEmotes")({
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

	static async fetchChannelFFZEmotes (channelData: Channel): Promise<Emote[]> {
		// @todo FFZ API type
		const response = await sb.Got.get("TwitchEmotes")({
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

	static async fetchChannelSevenTVEmotes (channelData: Channel): Promise<Emote[]> {
		// @todo 7TV API type
		const response = await sb.Got.get("TwitchEmotes")({
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

	async populateGlobalEmotes (): Promise<Emote[]> {
		// @todo Types for Twitch/Helix, BTTV, FFZ, 7TV APIs
		const [twitch, bttv, ffz, sevenTv] = await Promise.allSettled([
			TwitchPlatform.fetchTwitchEmotes(this.selfId),
			sb.Got.get("TwitchEmotes")({
				url: "https://api.betterttv.net/3/cached/emotes/global"
			}),
			sb.Got.get("TwitchEmotes")({
				url: "https://api.frankerfacez.com/v1/set/global"
			}),
			sb.Got.get("TwitchEmotes")({
				url: "https://7tv.io/v3/emote-sets/global"
			})
		]);

		const rawTwitchEmotes = (twitch.status === "fulfilled") ? twitch.value : [];
		const rawFFZEmotes = (ffz.status === "fulfilled") ? Object.values(ffz.value.body.sets) : {};
		const rawBTTVEmotes = (bttv.status === "fulfilled" && typeof bttv.value?.body === "object")
			? Object.values(bttv.value.body)
			: [];
		const rawSevenTvEmotes = (sevenTv.status === "fulfilled" && Array.isArray(sevenTv.value?.body?.emotes))
			? sevenTv.value.body.emotes
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
			// eslint-disable-next-line no-bitwise
			zeroWidth: (i.data.flags & SEVEN_TV_ZERO_WIDTH_FLAG)
		}));

		return [
			...twitchEmotes, ...ffzEmotes, ...bttvEmotes, ...sevenTvEmotes
		];
	}

	async fetchChannelEmotes (channelData: Channel): Promise<Emote[]> {
		const [bttv, ffz, sevenTv] = await Promise.allSettled([
			TwitchPlatform.fetchChannelBTTVEmotes(channelData),
			TwitchPlatform.fetchChannelFFZEmotes(channelData),
			TwitchPlatform.fetchChannelSevenTVEmotes(channelData)
		]);

		return [
			...((bttv.status === "fulfilled") ? bttv.value : []),
			...((ffz.status === "fulfilled") ? ffz.value : []),
			...((sevenTv.status === "fulfilled") ? sevenTv.value : []),
		];
	}

	async populateUserList (channelData: Channel) {
		return await TwitchUtils.getActiveUsernamesInChannel(channelData);
	}

	fetchInternalPlatformIDByUsername (userData: User): string | null {
		return userData.Twitch_ID;
	}

	async fetchUsernameByUserPlatformID (userPlatformID: string): Promise<string | null> {
		const response = await sb.Got.get("Helix")({
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

	async joinChannel (channelId: string) {
		return await Promise.all([
			TwitchUtils.createChannelChatMessageSubscription(this.selfId, channelId, this),
			TwitchUtils.createChannelOnlineSubscription(channelId),
			TwitchUtils.createChannelOfflineSubscription(channelId)
		]);
	}

	#pingWebsocket () {
		if (!this.client) {
			return;
		}

		const reconnectTimeout = setTimeout(() => {
			console.warn(`No ping received in ${NO_EVENT_RECONNECT_TIMEOUT}ms, reconnecting...`);
			this.client!.close();
			void this.connect({ skipSubscriptions: true });
		}, NO_EVENT_RECONNECT_TIMEOUT);

		const start = SupiDate.now();
		this.client.once("pong", () => {
			clearTimeout(reconnectTimeout);

			const end = SupiDate.now();
			this.#websocketLatency = end - start;
		});

		this.client.ping();
	}

	async fixChannelRename (channelData: Channel, twitchChanelName: string, channelId: string) {
		const existingChannelName = await sb.Query.getRecordset<string | undefined>(rs => rs
			.select("Name")
			.from("chat_data", "Channel")
			.where("Name = %s", twitchChanelName)
			.where("Platform = %n", this.ID)
			.single()
			.flat("Name")
		);

		const oldName = channelData.Name;
		if (!existingChannelName) {
			await channelData.saveProperty("Name", twitchChanelName);
			await sb.Logger.log(
				"Twitch.Success",
				`Name mismatch fixed: ${channelId}: Old=${oldName} New=${twitchChanelName}`
			);
		}
		else {
			this.#unsuccessfulRenameChannels.add(channelId);
			await sb.Logger.log(
				"Twitch.Warning",
				`Name conflict detected: ${channelId}: Old=${oldName} New=${twitchChanelName}`
			);
		}

		return {
			exists: Boolean(existingChannelName)
		};
	}

	initListeners (): void {}

	destroy () {
		if (this.client) {
			this.client.terminate();
		}

		this.client = null;
	}

	get websocketLatency () { return this.#websocketLatency; }

	static async fetchAccountChallengeStatus (userData: User, twitchID: string) {
		return await sb.Query.getRecordset<string | undefined>(rs => rs
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

	static async createAccountChallenge (userData: User, twitchID: string) {
		const row = await sb.Query.getRow("chat_data", "User_Verification_Challenge");
		const challenge = randomBytes(16).toString("hex");

		const discordPlatform = Platform.get("discord");
		const twitchPlatform = Platform.get("twitch");
		if (!discordPlatform || !twitchPlatform) {
			throw new SupiError({
				message: "Missing platform(s) to create a verification challenge"
			});
		}
		row.setValues({
			User_Alias: userData.ID,
			Specific_ID: twitchID,
			Challenge: challenge,
			Platform_From: twitchPlatform.ID,
			Platform_To: discordPlatform.ID
		});

		await row.save();
		return {
			challenge
		};
	}
}

export default TwitchPlatform;

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
