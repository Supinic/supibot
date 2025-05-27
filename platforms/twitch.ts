import WebSocket from "ws";
import { randomBytes } from "node:crypto";

import { Platform, BaseConfig } from "./template.js";
import cacheKeys from "../utils/shared-cache-keys.json" with { type: "json" };

import TwitchUtils, {
	MessageNotification,
	isMessageNotification,
	TwitchWebsocketMessage,
	isWelcomeMessage,
	isReconnectMessage,
	isRevocationMessage,
	isNotificationMessage,
	isKeepaliveMessage,
	NotificationMessage,
	SessionReconnectMessage,
	isWhisperNotification,
	isRaidNotification,
	isSubscribeNotification,
	isStreamChangeNotification,
	WhisperNotification,
	SubscribeMessageNotification,
	RaidNotification, StreamOnlineNotification, StreamOfflineNotification, BroadcasterSubscription
} from "./twitch-utils.js";

import { Channel } from "../classes/channel.js";
import { User } from "../classes/user.js";
import { SupiDate, SupiError } from "supi-core";
import type { Emote } from "../@types/globals.d.ts";

// Reference: https://github.com/SevenTV/API/blob/master/data/model/emote.model.go#L68
// Flag name: EmoteFlagsZeroWidth
const SEVEN_TV_ZERO_WIDTH_FLAG = 0b100000000;

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
const TWITCH_SUBSCRIPTION_PLANS = {
	1000: "$5",
	2000: "$10",
	3000: "$25",
	Prime: "Prime"
} as const;

type MessageRejectionRow = {
	Timestamp: SupiDate;
	Channel: Channel["ID"] | null;
	Status: number;
	Error: string | null;
	Error_Message: string | null;
	Chat_Message: string;
};
let messageRejectionTableExists: boolean | null = null;
const logMessageRejection = async (data: Omit<MessageRejectionRow, "Timestamp">) => {
	messageRejectionTableExists ??= await core.Query.isTablePresent("data", "Message_Rejection_Log");
	if (!messageRejectionTableExists) {
		return;
	}

	const row = await core.Query.getRow<MessageRejectionRow>("data", "Message_Rejection_Log");
	row.setValues({
		...data,
		Timestamp: new SupiDate()
	});
	await row.save({ skipLoad: true });
};

type UserLookupResponse = {
	data: {
		id: string;
		login: string;
		display_name: string;
		type: "" | "staff" | "global_mod" | "admin";
		broadcaster_type: "" | "affliate" | "partner";
		description: string;
		profile_image_url: string;
		offline_image_url: string;
		/** @deprecated This field has been deprecated. Any data in this field is not valid and should not be used */
		view_count: number;
		created_at: string;
	}[];
};
type HelixEmote = {
	id: string;
	name: string;
	emote_type:
		| "none" | "bitstier" | "follower" | "subscriptions" | "channelpoints"
		| "rewards" | "hypetrain" | "prime" | "turbo" | "smilies"
		| "owl2019" | "twofactor" | "limitedtime";
	emote_set_id: string;
	owner_id: string;
	format: ("animated" | "static")[];
	scale: ("1.0" | "2.0" | "3.0")[];
	theme_mode: ("dark" | "light")[];
};
type HelixEmoteResponse = {
	data: HelixEmote[];
	template: string;
	pagination: { cursor?: string; };
};

type BttvEmote = {
	id: string;
	code: string;
	imageType: "gif" | "png";
	animated?: boolean;
	userId: string;
	height?: number;
	width?: number;
};
type BttvEmoteResponse = {
	id: string;
	bots: string[];
	avatar: string;
	channelEmotes: BttvEmote[];
	sharedEmotes: BttvEmote[];
};

type FfzEmote = {
	id: number;
	name: string;
	height: number;
	width: number;
	public: boolean;
	hidden: boolean;
	modifier: boolean;
	modifier_flags: number;
	offset: unknown;
	margins: unknown;
	css: unknown;
	owner: {
		_id: number;
		name: string;
		display_name: string;
	};
	artist: unknown;
	urls: {
		1: string;
		2: string;
		4: string;
	};
	status: number;
	usage_count: number;
	created_at: string;
	last_updated: string;
}
type FfzEmoteResponse = {
	sets: Record<string, {
		id: string;
		icon: string | null;
		title: string;
		emoticons: FfzEmote[];
	}>;
};

type SevenTvEmote = {
	id: string;
	name: string;
	animated: boolean;
	data: {
		flags: number;
		animated: boolean;
	};
};
type SevenTvEmoteResponse = {
	id: string;
	platform: string;
	username: string;
	display_name: string;
	emote_set: {
		id: string;
		name: string;
		emotes?: SevenTvEmote[];
	};
};
type GlobalSevenTvEmoteResponse = SevenTvEmoteResponse["emote_set"] & {
	emotes: SevenTvEmote[];
};

export type MessageData = {
	text: string;
	fragments: MessageNotification["payload"]["event"]["message"]["fragments"];
	type: MessageNotification["payload"]["event"]["message_type"];
	id: MessageNotification["payload"]["event"]["message_id"];
	bits: MessageNotification["payload"]["event"]["cheer"];
	badges: MessageNotification["payload"]["event"]["badges"];
	color: MessageNotification["payload"]["event"]["color"];
	animationId: MessageNotification["payload"]["event"]["channel_points_animation_id"];
	rewardId: MessageNotification["payload"]["event"]["channel_points_custom_reward_id"];
};

type ConnectOptions = {
	url?: string;
	skipSubscriptions?: boolean;
};

export interface TwitchConfig extends BaseConfig {
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
	public readonly supportsMeAction = true;
	public readonly dynamicChannelAddition = true;
	private readonly reconnectCheck: NodeJS.Timeout;
	private readonly previousMessageMeta: Map<Channel["ID"], { time: number; length: number; }> = new Map();
	private readonly userCommandSpamPrevention: Map<User["ID"], number> = new Map();

	#websocketLatency: number | null = null;
	#unsuccessfulRenameChannels = new Set();

	public readonly debug = TwitchUtils;
	private client: WebSocket | null = null;

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

		this.reconnectCheck = setInterval(() => this.#pingWebsocket(), 30_000);
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
		ws.on("message", (data: Buffer) => void this.handleWebsocketMessage(data));

		this.client = ws;

		if (!options.skipSubscriptions) {
			const existingSubs = await TwitchUtils.getExistingSubscriptions(false);

			const existingWhisperSub = existingSubs.some(i => i.type === "user.whisper.message");
			if (!existingWhisperSub) {
				await TwitchUtils.createWhisperMessageSubscription(this.selfId);
			}

			type ChatMessageSubscription = MessageNotification["payload"]["subscription"];
			const existingChannelSubs = existingSubs.filter(i => i.type === "channel.chat.message") as ChatMessageSubscription[];
			const existingChannelIds = new Set(existingChannelSubs.map(i => i.condition.broadcaster_user_id));

			const channelList = sb.Channel.getJoinableForPlatform(this);
			const missingChannels = channelList.filter(i => {
				if (!i.Specific_ID) {
					return false;
				}

				return !existingChannelIds.has(i.Specific_ID);
			});

			const batchSize = 100;
			for (let index = 0; index < missingChannels.length; index += batchSize) {
				const slice = missingChannels.slice(index, index + batchSize);
				const joinPromises = slice.map(async channel => {
					if (!channel.Specific_ID) {
						return;
					}

					await this.joinChannel(channel.Specific_ID);
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

	async handleWebsocketMessage (data: Buffer) {
		const message: TwitchWebsocketMessage = JSON.parse(data.toString()) as TwitchWebsocketMessage;

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
		else if (isKeepaliveMessage(message)) {
			// Do nothing
		}
		else {
			console.log("Unrecognized message", { message });
		}
	}

	async handleWebsocketNotification (data: NotificationMessage) {
		if (isMessageNotification(data)) {
			await this.handleMessage(data);
		}
		else if (isWhisperNotification(data)) {
			await this.handlePrivateMessage(data);
		}
		else if (isSubscribeNotification(data)) {
			await this.handleSub(data);
		}
		else if (isRaidNotification(data)) {
			await this.handleRaid(data);
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
			const { length = 0, time = 0 } = this.previousMessageMeta.get(channelData.ID) ?? {};
			if (time + WRITE_MODE_MESSAGE_DELAY > now) {
				setTimeout(() => void this.send(message, channelData), now - time);
				return;
			}

			// Ad-hoc figuring out whether the message about to be sent is the same as the previous message.
			// Ideally, this is determined by string comparison, but keeping strings of last messages over
			// thousands of channels isn't exactly memory friendly. So we just keep the lengths and hope it works.
			if (message.length === length) {
				message += ` ${this.config.sameMessageEvasionCharacter}`;
			}
		}

		type MessageSendSuccess = {
			message_id: string;
			is_sent: true;
			drop_reason: null
		};
		type MessageSendFailure = {
			message_id: "";
			is_sent: false;
			drop_reason: { code: string; message: string; };
		};
		type SendMessageResponse = {
			data: (MessageSendSuccess | MessageSendFailure)[];
		};

		const response = await core.Got.get("Helix")<SendMessageResponse>({
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
			const errorResponse = response.body as unknown as { message: string; error: string; }; // @todo type error case properly
			void logMessageRejection({
				Channel: channelData.ID,
				Chat_Message: message,
				Status: response.statusCode,
				Error: errorResponse.error,
				Error_Message: errorResponse.message
			});

			return;
		}

		const replyData = response.body.data[0];
		if (!replyData.is_sent) {
			void logMessageRejection({
				Channel: channelData.ID,
				Chat_Message: message,
				Status: response.statusCode,
				Error: replyData.drop_reason.code,
				Error_Message: replyData.drop_reason.message
			});

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
			this.previousMessageMeta.set(channelData.ID, {
				length: message.length,
				time: SupiDate.now()
			});
		}
	}

	async me (message: string, channel: Channel) {
		await this.send(message, channel, { meAction: true });
	}

	async pm (message: string, userData: User) {
		const joinOverride = this.config.joinChannelsOverride ?? [];
		if (this.config.suspended || joinOverride.length !== 0) {
			return;
		}

		let targetUserId = userData.Twitch_ID;
		if (!targetUserId) {
			const response = await core.Got.get("Helix")<UserLookupResponse>({
				url: "users",
				searchParams: {
					login: userData.Name
				}
			});

			const helixUserData = response.body.data;
			if (!response.ok || helixUserData.length === 0) {
				throw new SupiError({
					message: "No Helix data found for user",
					args: {
						ID: userData.ID,
						name: userData.Name
					}
				});
			}

			await userData.saveProperty("Twitch_ID", helixUserData[0].id);
			targetUserId = helixUserData[0].id;
		}

		const trimmedMessage = message
			.replaceAll(/[\r\n]/g, " ")
			.trim();

		const whisperMessageLimit = this.config.whisperMessageLimit ?? FALLBACK_WHISPER_MESSAGE_LIMIT;
		const response = await core.Got.get("Helix")({
			method: "POST",
			url: "whispers",
			searchParams: {
				from_user_id: this.selfId,
				to_user_id: targetUserId
			},
			json: {
				message: core.Utils.wrapString(trimmedMessage, whisperMessageLimit)
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
		if (channelData.Platform !== this) {
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

		type ModerationBanResponse = {
			data: {
				broadcaster_id: string;
				moderator_id: string;
				user_id: string;
				created_at: string;
				end_time: string;
			}[];
		};
		const response = await core.Got.get("Helix")<ModerationBanResponse>({
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

	async handleMessage (notification: MessageNotification) {
		const { event } = notification.payload;
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

		const messageData: MessageData = {
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
				const message = core.Utils.tag.trim `
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
					const replyMessage = core.Utils.tag.trim `
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
			platform: this
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
			void this.mirror(messageData.text, userData, channelData, { commandUsed: false });
		}

		this.incrementMessageMetric("read", channelData);

		// Own message - check the regular/vip/mod/broadcaster status, and skip
		if (senderUserId === this.selfId) {
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
				const row = await core.Query.getRow("chat_data", "Channel");
				await row.load(channelData.ID);
				row.values.Mode = channelData.Mode;
				await row.save();
			}

			return;
		}

		if (this.logging.bits && cheer) {
			void sb.Logger.log("Twitch.Other", `${cheer.bits} bits`, channelData, userData);
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
		const timeout = this.userCommandSpamPrevention.get(userData.ID);
		if (typeof timeout === "number" && timeout > now) {
			return;
		}

		const threshold = this.config.spamPreventionThreshold ?? 100;
		this.userCommandSpamPrevention.set(userData.ID, now + threshold);

		const [command, ...args] = targetMessage
			.replace(sb.Command.prefix, "")
			.split(/\s+/)
			.filter(Boolean);

		await this.handleCommand(
			command,
			userData,
			channelData,
			args,
			{ privateMessage: false },
			messageData
		);
	}

	async handlePrivateMessage (notification: WhisperNotification) {
		const {
			from_user_login: senderUsername,
			from_user_id: senderUserId,
			whisper
		} = notification.payload.event;

		const userData = await sb.User.get(senderUsername, false, { Twitch_ID: senderUserId });
		if (!userData) {
			return;
		}

		const message = whisper.text;
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

		const result = await this.handleCommand(
			command,
			userData,
			null,
			args,
			{ privateMessage: true },
			null
		);

		if (!result.success) {
			if (!result.reply && result.reason === "filter") {
				const filteredMessage = this.config.privateMessageResponseFiltered ?? PRIVATE_COMMAND_FILTERED_RESPONSE;
				await this.pm(filteredMessage, userData);
			}
			else if (result.reason === "no-command") {
				const noCommandResponse = this.config.privateMessageResponseNoCommand ?? PRIVATE_COMMAND_NO_COMMAND_RESPONSE;
				await this.pm(noCommandResponse, userData);
			}
		}
	}

	async handleSub (notification: SubscribeMessageNotification) {
		const { event } = notification.payload;

		const userData = await sb.User.get(event.user_login);
		const channelData = sb.Channel.get(event.broadcaster_user_login);
		if (!channelData) {
			return;
		}

		await sb.Logger.log("Twitch.Sub", JSON.stringify({ event }));

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
				plan: TWITCH_SUBSCRIPTION_PLANS[event.tier]
			}
		});
	}

	async handleRaid (notification: RaidNotification) {
		const {
			to_broadcaster_user_id: channelId,
			to_broadcaster_user_login: channelName,
			from_broadcaster_user_login: fromName,
			viewers
		} = notification.payload.event;

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
				viewers
			}
		});

		if (this.logging.hosts) {
			await sb.Logger.log("Twitch.Host", `Raid: ${fromName} => ${channelData.Name} for ${viewers} viewers`);
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
		else {
			channelData.events.emit("offline", {
				event: "offline",
				channel: channelData
			});

			await this.removeLiveChannelIdList(channelId);
		}
	}

	// eslint-disable-next-line max-params
	async handleCommand (
		command: string,
		user: User,
		channel: Channel | null,
		args: string[] = [],
		options: { privateMessage: boolean; },
		specificData: MessageData | null
	) {
		const execution = await sb.Command.checkAndExecute({
			command,
			args,
			user,
			channel,
			platform: this,
			options,
			platformSpecificData: specificData
		});

		if (!execution.reply) {
			return execution;
		}

		const commandOptions = sb.Command.extractMetaResultProperties(execution);
		if (options.privateMessage || execution.replyWithPrivateMessage) {
			const message = await this.prepareMessage(execution.reply, null, {
				...commandOptions,
				skipBanphrases: true,
				skipLengthCheck: true
			});

			if (message) {
				await this.pm(message, user);
			}
		}
		else {
			if (!channel) {
				throw new SupiError({
					message: "Assert error - No Channel in public command response"
				});
			}

			if (channel.Mirror) {
				await this.mirror(execution.reply, user, channel, {
					...commandOptions,
					commandUsed: true
				});
			}

			const message = await this.prepareMessage(execution.reply, channel, {
				...commandOptions,
				skipBanphrases: true
			});

			if (message) {
				if (execution.replyWithMeAction === true) {
					await this.me(message, channel);
				}
				else {
					await this.send(message, channel);
				}
			}
		}

		return execution;
	}

	isUserChannelOwner (channelData: Channel, userData: User) {
		return Promise.resolve(channelData.Specific_ID === userData.Twitch_ID);
	}

	async getUserID (user: string): Promise<string | null> {
		const response = await core.Got.get("Helix")<UserLookupResponse>({
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

	createUserMention (userData: User) {
		return Promise.resolve(`@${userData.Name}`);
	}

	/**
	 * Determines whether a user is subscribed to a given Twitch channel.
	 */
	async fetchUserAdminSubscription (userData: User) {
		const subscriberList = await core.Cache.getByPrefix(TWITCH_ADMIN_SUBSCRIBER_LIST) as BroadcasterSubscription[] | null;
		if (!subscriberList || !Array.isArray(subscriberList)) {
			return false;
		}

		return subscriberList.some(i => i.user_id === userData.Twitch_ID);
	}

	async getLiveChannelIdList (): Promise<string[]> {
		return await core.Cache.server.lrange(LIVE_STREAMS_KEY, 0, -1);
	}

	async addLiveChannelIdList (channelId: string): Promise<number> {
		return await core.Cache.server.lpush(LIVE_STREAMS_KEY, channelId);
	}

	async removeLiveChannelIdList (channelId: string): Promise<number> {
		return await core.Cache.server.lrem(LIVE_STREAMS_KEY, 1, channelId);
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

	static async fetchTwitchEmotes (selfId: string) {
		const response = await core.Got.get("Helix")<HelixEmoteResponse>({
			url: "chat/emotes/user",
			method: "GET",
			throwHttpErrors: false,
			searchParams: {
				user_id: selfId
			}
		});

		const result = response.body.data;
		let { cursor } = response.body.pagination;
		while (cursor) {
			const pageResponse = await core.Got.get("Helix")<HelixEmoteResponse>({
				url: "chat/emotes/user",
				method: "GET",
				throwHttpErrors: false,
				searchParams: {
					user_id: selfId,
					after: cursor
				}
			});

			result.push(...pageResponse.body.data);
			cursor = pageResponse.body.pagination.cursor;
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

		const response = await core.Got.get("TwitchEmotes")<BttvEmoteResponse>({
			url: `https://api.betterttv.net/3/cached/users/twitch/${channelID}`
		});

		if (!response.ok) {
			if (response.statusCode !== 404) {
				await sb.Logger.log("Twitch.Warning", `BTTV emote fetch failed, code: ${response.statusCode}`, channelData);
			}

			return [];
		}

		const emotes = [
			...response.body.channelEmotes,
			...response.body.sharedEmotes
		];

		return emotes.map(i => ({
			ID: i.id,
			name: i.code,
			type: "bttv",
			global: false,
			animated: i.animated ?? (i.imageType === "gif"),
			zeroWidth: false
		}));
	}

	static async fetchChannelFFZEmotes (channelData: Channel): Promise<Emote[]> {
		const response = await core.Got.get("TwitchEmotes")<FfzEmoteResponse>({
			url: `https://api.frankerfacez.com/v1/room/${channelData.Name}`
		});

		if (!response.ok) {
			if (response.statusCode !== 404) {
				await sb.Logger.log("Twitch.Warning", `FFZ emote fetch failed, code: ${response.statusCode}`, channelData);
			}

			return [];
		}

		const emotes = Object.values(response.body.sets).flatMap(i => i.emoticons);

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
		const response = await core.Got.get("TwitchEmotes")<SevenTvEmoteResponse>({
			url: `https://7tv.io/v3/users/twitch/${channelData.Specific_ID}`
		});

		if (!response.ok) {
			if (response.statusCode !== 404) {
				await sb.Logger.log("Twitch.Warning", `7TV emote fetch failed, code: ${response.statusCode}`, channelData);
			}

			return [];
		}

		const rawEmotes = response.body.emote_set.emotes ?? [];
		return rawEmotes.map(i => ({
			ID: i.id,
			name: i.name,
			type: "7tv",
			global: false,
			animated: i.data.animated,
			// eslint-disable-next-line no-bitwise
			zeroWidth: Boolean(i.data.flags & SEVEN_TV_ZERO_WIDTH_FLAG)
		}));
	}

	async populateGlobalEmotes (): Promise<Emote[]> {
		const [twitch, bttv, ffz, sevenTv] = await Promise.allSettled([
			TwitchPlatform.fetchTwitchEmotes(this.selfId),
			core.Got.get("TwitchEmotes")<BttvEmote[]>({
				url: "https://api.betterttv.net/3/cached/emotes/global"
			}),
			core.Got.get("TwitchEmotes")<FfzEmoteResponse>({
				url: "https://api.frankerfacez.com/v1/set/global"
			}),
			core.Got.get("TwitchEmotes")<GlobalSevenTvEmoteResponse>({
				url: "https://7tv.io/v3/emote-sets/global"
			})
		]);

		const rawTwitchEmotes = (twitch.status === "fulfilled") ? twitch.value : [];
		const rawFFZEmotes = (ffz.status === "fulfilled") ? Object.values(ffz.value.body.sets) : [];
		const rawBTTVEmotes = (bttv.status === "fulfilled" && typeof bttv.value.body === "object")
			? Object.values(bttv.value.body)
			: [];
		const rawSevenTvEmotes = (sevenTv.status === "fulfilled" && Array.isArray(sevenTv.value.body.emotes))
			? sevenTv.value.body.emotes
			: [];

		const twitchEmotes = rawTwitchEmotes.map(i => {
			let type: "twitch-global" | "twitch-subscriber" | "twitch-follower" = "twitch-global";
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
				channel: i.owner_id
			};
		});
		const ffzEmotes = rawFFZEmotes.flatMap(i => i.emoticons).map(i => ({
			ID: i.id,
			name: i.name,
			type: "ffz" as const,
			global: true,
			animated: false
		}));
		const bttvEmotes = rawBTTVEmotes.map(i => ({
			ID: i.id,
			name: i.code,
			type: "bttv" as const,
			global: true,
			animated: (i.imageType === "gif")
		}));
		const sevenTvEmotes = rawSevenTvEmotes.map(i => ({
			ID: i.id,
			name: i.name,
			type: "7tv" as const,
			global: true,
			animated: i.data.animated,
			// eslint-disable-next-line no-bitwise
			zeroWidth: Boolean(i.data.flags & SEVEN_TV_ZERO_WIDTH_FLAG)
		}));

		return [
			...twitchEmotes,
			...ffzEmotes,
			...bttvEmotes,
			...sevenTvEmotes
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
			...((sevenTv.status === "fulfilled") ? sevenTv.value : [])
		];
	}

	async populateUserList (channelData: Channel) {
		return await TwitchUtils.getActiveUsernamesInChannel(channelData);
	}

	fetchInternalPlatformIDByUsername (userData: User): string | null {
		return userData.Twitch_ID;
	}

	async fetchUsernameByUserPlatformID (userPlatformID: string): Promise<string | null> {
		const response = await core.Got.get("Helix")<UserLookupResponse>({
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
		const client = this.client;
		if (!client) {
			return;
		}

		const reconnectTimeout = setTimeout(() => {
			console.warn(`No ping received in ${NO_EVENT_RECONNECT_TIMEOUT}ms, reconnecting...`);
			client.close();
			void this.connect({ skipSubscriptions: true });
		}, NO_EVENT_RECONNECT_TIMEOUT);

		const start = SupiDate.now();
		client.once("pong", () => {
			clearTimeout(reconnectTimeout);

			const end = SupiDate.now();
			this.#websocketLatency = end - start;
		});

		client.ping();
	}

	async fixChannelRename (channelData: Channel, twitchChanelName: string, channelId: string) {
		const existingChannelName = await core.Query.getRecordset<string | undefined>(rs => rs
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
		return await core.Query.getRecordset<string | undefined>(rs => rs
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
		const row = await core.Query.getRow("chat_data", "User_Verification_Challenge");
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
