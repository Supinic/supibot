import type { Channel } from "./channel.js";
import type { User } from "./user.js";
import type { SimpleGenericData } from "../@types/globals.js";
import type { Query } from "supi-core";

type PoolConnection = Awaited<ReturnType<Query["getTransaction"]>>;
export type GenericFetchData = {
	forceCacheReload?: boolean;
	transaction?: PoolConnection;
};

type PrimitiveTag = "number" | "boolean" | "string";
const isPrimitiveTag = (input: unknown): input is PrimitiveTag => (
	input === "number" || input === "boolean" || input === "string"
);

function parsePrimitiveTag (input: string, type: "boolean"): boolean;
function parsePrimitiveTag (input: string, type: "number"): number;
function parsePrimitiveTag (input: string, type: "string"): string;
function parsePrimitiveTag (input: string, type: PrimitiveTag): number | string | boolean;
function parsePrimitiveTag (input: string, type: PrimitiveTag): number | string | boolean {
	if (type === "string") {
		return String(type);
	}
	else if (type === "number") {
		return Number(type);
	}
	else {
		return (input === "true");
	}
}

type BaseType <T extends PrimitiveTag> =
	T extends "boolean" ? boolean :
	T extends "number" ? number :
	T extends "string" ? string
	: never;

type ConvertSchemaToType<T> = {
	[K in keyof T]:
		T[K] extends PrimitiveTag ? BaseType<T[K]> | null : // converts primitives into types, `"string"` => `string`
		T[K] | null // uses the defined type itself, `{} as { XYZ: unknown; }` => `{ XYZ: unknown; }`
};

const channelDataSchema = {
	ambassadors: [] as User["ID"][],
	botScopeNotificationSent: "number",
	disableDiscordGlobalEmotes: "boolean",
	discord: "string",
	fishConfig: {} as {
		whisperOnFailure?: boolean,
		discordReactionType?: "all" | "fail-only" | "none",
	},
	forceRustlog: "boolean",
	globalPingRemoved: "boolean",
	inactiveReason: "string",
	instagramNSFW: "boolean",
	logsRemovedReason: "string",
	offlineOnlyBot: {} as {
		started: string,
		mode: Channel["Mode"],
	},
	offlineOnlyMirror: "boolean",
	redditNSFW: "boolean",
	removeReason: "string",
	sharedCustomData: {} as SimpleGenericData,
	showFullCommandErrorMessage: "boolean",
	stalkPrevention: "boolean",
	twitchLottoBlacklistedFlags: [] as string[], // @todo
	twitchLottoNSFW: "boolean",
	twitchLottoSafeMode: "boolean",
	twitchNoScopeDisabled: "boolean",
	twitterNSFW: "boolean"
} as const;

const userDataSchema = {
	administrator: "boolean",
	animals: {} as Record<"bird" | "cat" | "dog" | "fox", {
		verified: true;
		notes: string | null;
	}>,
	authKey: "string",
	banWavePartPermissions: [] as Channel["ID"][],
	birthday: {} as {
		month: number;
		day: number;
		string: string;
	},
	chatGptHistoryMode: "" as "disabled" | "enabled",
	cookie: {} as {
		lastTimestamp: {
			daily: number;
			received: number;
		};
		today: {
			timestamp: number;
			donated: number;
			received: number;
			eaten: {
				daily: number;
				received: number;
			};
		};
		total: {
			donated: number;
			received: number;
			eaten: {
				daily: number;
				received: number;
			};
		};
		legacy: {
			daily: number;
			donated: number;
			received: number;
		};
	},
	customDeveloperData: {} as SimpleGenericData,
	defaultUserLanguage: {} as {
		code: string;
		nname: string;
	},
	developer: "boolean",
	discordChallengeNotificationSent: "boolean",
	fishData: {} as {
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
			active: false;
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
			};
		};
	},
	github: {} as {
		created: number,
		login: string,
		type: string,
	},
	inspectErrorStacks: "boolean",
	leagueDefaultRegion: "string",
	leagueDefaultUserIdentifier: "string",
	location: {} as {
		formatted: string;
		placeID: string;
		components: {
			country: string;
			locality?: string;
			level1?: string;
			level2?: string;
			level3?: string;
		};
		hidden: boolean;
		coordinates: {
			lat: number;
			lng: number;
		};
		original: string;
		timezone: {
			dstOffset: number;
			stringOffset: string;
			offset: number;
			name: string;
		};
	},
	noAbbChatter: "boolean",
	osrsGameUsername: "string",
	pathOfExile: {} as {
		uniqueTabs: string;
	},
	platformVerification: {} as Record<number, {
		active?: boolean;
		notificationSent?: boolean;
	}>,
	previousUserID: "string",
	skipGlobalPing: "boolean",
	supinicStreamSongRequestExtension: "number",
	supiPoints: "number",
	/** @deprecated */
	timers: {} as Record<string, { date: number; }>,
	trackLevel: "string",
	trackListHelper: "boolean",
	trustedTwitchLottoFlagger: "boolean",
	"twitch-userid-mismatch-notification": "boolean"
} as const;

export type ChannelDataPropertyMap = ConvertSchemaToType<typeof channelDataSchema>;
export type UserDataPropertyMap = ConvertSchemaToType<typeof userDataSchema>;

export type ChannelDataProperty = keyof ChannelDataPropertyMap;
export type UserDataProperty = keyof UserDataPropertyMap;

const cachedChannelProperties: readonly ChannelDataProperty[] = [
	"ambassadors",
	"disableDiscordGlobalEmotes",
	"globalPingRemoved"
] as const;
export const isCachedChannelProperty = (input: ChannelDataProperty): boolean => cachedChannelProperties.includes(input);

const cachedUserProperties: readonly UserDataProperty[] = [
	"administrator",
	"animals",
	"developer",
	"platformVerification"
] as const;
export const isCachedUserProperty = (input: UserDataProperty): boolean => cachedUserProperties.includes(input);

type FetchData = {
	databaseTable: string;
	databaseProperty: string;
	instanceId: number;
	propertyName: string;
	transaction?: PoolConnection
};
type SpecificFetchOptions = Pick<FetchData, "transaction">;

const fetchRawDataProperty = async (data: FetchData): Promise<string | null> => {
	const {
		databaseTable,
		databaseProperty,
		instanceId,
		propertyName,
		transaction
	} = data;

	const rsOptions = (transaction) ? { transaction } : {};
	const rawValue = await core.Query.getRecordset<string | undefined>(
		rs => rs
			.select("Value")
			.from("chat_data", databaseTable)
			.where(`${databaseProperty} = %n`, instanceId)
			.where("Property = %s", propertyName)
			.flat("Value")
			.limit(1)
			.single(),
		rsOptions
	);

	return rawValue ?? null;
};

export const fetchChannelDataProperty = async <T extends ChannelDataProperty> (
	propertyName: T,
	instanceId: Channel["ID"],
	data: SpecificFetchOptions = {}
): Promise<ChannelDataPropertyMap[T]> => {
	const rawValue = await fetchRawDataProperty({
		instanceId,
		propertyName,
		databaseTable: "Channel_Data",
		databaseProperty: "Channel",
		transaction: data.transaction
	});

	if (rawValue === null) {
		return null;
	}

	let value: ChannelDataPropertyMap[T];
	const propertyTag = channelDataSchema[propertyName];
	if (isPrimitiveTag(propertyTag)) {
		value = parsePrimitiveTag(rawValue, propertyTag) as ChannelDataPropertyMap[T];
	}
	else {
		value = JSON.parse(rawValue) as ChannelDataPropertyMap[T];
	}

	return value;
};

export const fetchUserDataProperty = async <T extends UserDataProperty> (
	propertyName: T,
	instanceId: User["ID"],
	data: SpecificFetchOptions = {}
): Promise<UserDataPropertyMap[T]> => {
	const rawValue = await fetchRawDataProperty({
		instanceId,
		propertyName,
		databaseTable: "User_Alias_Data",
		databaseProperty: "User_Alias",
		transaction: data.transaction
	});

	if (rawValue === null) {
		return null;
	}

	let value: UserDataPropertyMap[T];
	const propertyTag = userDataSchema[propertyName];
	if (isPrimitiveTag(propertyTag)) {
		value = parsePrimitiveTag(rawValue, propertyTag) as UserDataPropertyMap[T];
	}
	else {
		value = JSON.parse(rawValue) as UserDataPropertyMap[T];
	}

	return value;
};

export const saveChannelDataProperty = async <T extends ChannelDataProperty> (
	propertyName: T,
	value: ChannelDataPropertyMap[T],
	instanceId: Channel["ID"],
	options: SpecificFetchOptions = {}
): Promise<void> => {
	type RowData = { Property: T; Channel: Channel["ID"]; Value: string | null };
	const row = await core.Query.getRow<RowData>("chat_data", "Channel_Data", options);

	await row.load({ Property: propertyName, Channel: instanceId }, true);

	let rawValue: string | null = null;
	if (value === null) {
		rawValue = null;
	}
	else if (typeof channelDataSchema[propertyName] === "object") {
		rawValue = JSON.stringify(value as object); // Guaranteed by condition
	}
	else {
		rawValue = String(value as string | number | boolean); // Guaranteed by previous conditions
	}

	row.setValues({
		Property: propertyName,
		Channel: instanceId,
		Value: rawValue
	});

	await row.save({ skipLoad: true });
};

export const saveUserDataProperty = async <T extends UserDataProperty> (
	propertyName: T,
	value: UserDataPropertyMap[T] ,
	instanceId: User["ID"],
	options: SpecificFetchOptions = {}
): Promise<void> => {
	type RowData = { Property: T; User_Alias: User["ID"]; Value: string | null; };
	const row = await core.Query.getRow<RowData>("chat_data", "User_Alias_Data", options);

	await row.load({ Property: propertyName, User_Alias: instanceId }, true);

	let rawValue: string | null = null;
	if (value === null) {
		rawValue = null;
	}
	else if (typeof userDataSchema[propertyName] === "object") {
		rawValue = JSON.stringify(value as object); // Guaranteed by condition
	}
	else {
		rawValue = String(value as string | number | boolean); // Guaranteed by previous conditions
	}

	row.setValues({
		Property: propertyName,
		User_Alias: instanceId,
		Value: rawValue
	});

	await row.save({ skipLoad: true });
};
