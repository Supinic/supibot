import { Log, Platform } from "./template";
import { Mode } from "../classes/channel";

declare type ModQueueData = Record<Mode, { queueSize: number, cooldown: number }>;
declare type ReconnectAnnouncementData = {
	channels: string[];
	string: string;
};
declare type Notice = string;

declare interface TwitchLog extends Log {
	bans: boolean;
	bits: boolean;
	channelJoins: boolean;
	clearchat: boolean;
	giftSubs: boolean;
	subs: boolean;
	timeouts: boolean;
}
declare interface TwitchData {
	modes: ModQueueData;
	reconnectAnnouncement: ReconnectAnnouncementData;
	defaultGlobalCooldown: number;
	defaultQueueSize: number;
	subscriptionPlans: Record<string, string>;
	partChannelsOnPermaban: boolean;
	clearRecentBansTimer: number;
	recentBanThreshold: number | null;
	updateAvailableBotEmotes: boolean;
	ignoredUserNotices: Notice[];
	sameMessageEvasionCharacter: string;
	rateLimits: "default" | "knownBot" | "verifiedBot",
	emitLiveEventsOnlyForFlaggedChannels: boolean;
	suspended: boolean;
	joinChannelsOverride: string[];
	spamPreventionThreshold: number;
	sendVerificationChallenge: boolean;
	recentBanPartTimeout: number;
	trackChannelsLiveStatus: boolean;
	whisperMessageLimit: number;
}

export declare class TwitchPlatform extends Platform {
	readonly Logging: TwitchLog;
	readonly Defaults: Partial<TwitchPlatform["Data"]>;
	readonly Data: TwitchData;
}
