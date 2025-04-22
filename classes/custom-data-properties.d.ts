import type { Channel } from "./channel.js";
import type { User } from "./user.js";
import type { SimpleGenericData } from "../@types/globals.js";

export type ChannelDataPropertyMap = {
	ambassadors: User["ID"][];
	botScopeNotificationSent: number;
	disableDiscordGlobalEmotes: boolean;
	discord: string;
	fishConfig: {};
	forceRustlog: boolean;
	globalPingRemoved: boolean;
	inactiveReason: string;
	instagramNSFW: boolean;
	logsRemovedReason: string;
	offlineOnlyBot: {
		started: string;
		mode: Channel["Mode"];
	};
	offlineOnlyMirror: boolean;
	redditNSFW: boolean;
	removeReason: string;
	sharedCustomData: SimpleGenericData;
	showFullCommandErrorMessage: boolean;
	stalkPrevention: boolean;
	twitchLottoBlacklistedFlags: string[]; // @todo
	twitchLottoNSFW: boolean;
	twitchLottoSafeMode: boolean;
	twitchNoScopeDisabled: boolean;
	twitterNSFW: boolean;
};

export type UserDataPropertyMap = {
	administrator: boolean;
	animals: Record<"bird" | "cat" | "dog" | "fox", {
		verified: true;
		notes: string | null;
	}>;
	authKey: string;
	banWavePartPermissions: Channel["ID"][];
	birthday: {
		month: number;
		day: number;
		string: string;
	};
	chatGptHistoryMode: "enabled" | "disabled";
	cookie: {
		lastTimestamp: {
			daily: number;
			received: number;
		},
		today: {
			timestamp: number;
			donated: number;
			received: number;
			eaten: {
				daily: number;
				received: number;
			};
		},
		total: {
			donated: number;
			received: number;
			eaten: {
				daily: number;
				received: number;
			};
		},
		legacy: {
			daily: number;
			donated: number;
			received: number;
		};
	};
	customDeveloperData: SimpleGenericData;
	defaultUserLanguage: {
		code: string;
		nname: string;
	};
	developer: boolean;
	discordChallengeNotificationSent: boolean;
	fishData: {
		catch: {
			luckyStreak: number;
			dryStreak: number;
			types: Record<string, number>;
			fish: number;
			junk?: number;
		};
		readyTimestamp: number;
		coins: number;
		trap?: {
			active: false,
			start: number;
			end: number;
			duration: number;
		};
		lifetime: {
			fish: number;
			coins: number;
			sold: number;
			baitUsed: number;
			attempts: number;
			dryStreak: number;
			luckyStreak: number;
			maxFishSize: number;
			maxFishType: string | null;
			junk?: number | null;
			trap?: {
				times: number;
				timeSpent: number;
				bestFishCatch: number;
				cancelled: number;
			}
		}
	};
	github: {
		created: number;
		login: string;
		type: string;
	};
	inspectErrorStacks: boolean;
	leagueDefaultRegion: string;
	leagueDefaultUserIdentifier: string;
	location: {
		formatted: string;
		placeID: string;
		components: {
			country: string;
			locality?: string;
			level1?: string;
			level2?: string;
			level3?: string;
		},
		hidden: boolean;
		coordinates: {
			lat: number;
			lng: number;
		},
		original: string;
		timezone: {
			dstOffset: number;
			stringOffset: string;
			offset: number;
			name: string;
		};
	};
	noAbbChatter: boolean;
	osrsGameUsername: string;
	pathOfExile: {
		uniqueTabs: string;
	};
	platformVerification: Record<number, {
		active?: boolean;
		notificationSent: boolean;
	}>;
	previousUserID: string;
	skipGlobalPing: boolean;
	supinicStreamSongRequestExtension: number;
	supiPoints: number;
	/** @deprecated */
	timers: Record<string, { date: number; }>;
	trackLevel: string;
	trackListHelper: boolean;
	trustedTwitchLottoFlagger: boolean;
	"twitch-userid-mismatch-notification": boolean;
};
