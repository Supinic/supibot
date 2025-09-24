import { SupiError } from "supi-core";
import * as z from "zod";

import type { Context } from "../../../classes/command.js";
import { typedEntries, typedKeys } from "../../../utils/ts-helpers.js";

const PLATFORMS = {
	br: ["br", "bra", "brasil", "brazil"],
	eun1: ["eune", "eu-north-east"],
	euw1: ["euw", "eu-west"],
	jp1: ["jp", "jap", "japan"],
	kr: ["kor", "sk", "korea"],
	la1: ["lan", "la-north"],
	la2: ["las", "la-south"],
	na1: ["na", "north-america"],
	oc1: ["oce", "ocea", "oceania"],
	tr1: ["tr", "tur", "turkey"],
	ru: ["rus", "russia"],
	ph2: ["ph", "phi", "phillipines"],
	sg2: ["sg", "singapore"],
	th2: ["tha", "thai", "thailand"],
	tw2: ["tw", "taiwan"],
	vn2: ["vn", "vietnam"]
};
export const REGIONS = {
	br: "americas",
	eun1: "europe",
	euw1: "europe",
	jp1: "asia",
	kr: "asia",
	la1: "americas",
	la2: "americas",
	me: "europe",
	na1: "americas",
	oc1: "sea",
	tr1: "europe",
	ru: "europe",
	ph2: "sea",
	sg2: "sea",
	th2: "sea",
	tw2: "sea",
	vn2: "sea"
};

export const GAME_RESULT = {
	END: "GameComplete"
};

export const NON_STANDARD_CHAMPION_NAMES: Record<string, string> = {
	AurelionSol: "Aurelion Sol",
	Belveth: "Bel'Veth",
	Chogath: "Cho'Gath",
	DrMundo: "Dr. Mundo",
	JarvanIV: "Jarvan IV",
	Kaisa: "Kai'Sa",
	Khazix: "Kha'Zix",
	KogMaw: "Kog'Maw",
	KSante: "K'Sante",
	LeeSin: "Lee Sin",
	MasterYi: "Master Yi",
	MissFortune: "Miss Fortune",
	Nunu: "Nunu & Willump",
	RekSai: "Rek'Sai",
	Renata: "Renata Glasc",
	TahmKench: "Tahm Kench",
	TwistedFate: "Twisted Fate",
	Velkoz: "Vel'Koz",
	XinZhao: "Xin Zhao"
};

export const DEFAULT_USER_IDENTIFIER_KEY = "leagueDefaultUserIdentifier";
export const DEFAULT_REGION_KEY = "leagueDefaultRegion";
export const QUEUE_DATA_CACHE_KEY = "league-queues-data";

export const TEAM_POSITIONS_MAP = {
	TOP: "top",
	MIDDLE: "mid",
	JUNGLE: "jungle",
	BOTTOM: "ADC",
	UTILITY: "support"
} as const;

const getPUUIdCacheKey = (gameName: string, tagLine: string) => `moba-league-puuid-${gameName}-${tagLine}`;
const getLeagueEntriesCacheKey = (platform: string, puuid: string) => `moba-league-entries-${platform}-${puuid}`;
const getMatchIdsKey = (summonerId: string) => `moba-league-match-ids-${summonerId}`;
const getMatchDataKey = (matchId: string) => `moba-league-match-data-${matchId}`;

const queueSchema = z.array(
	z.object({
		queueId: z.int(),
		map: z.string(),
		description: z.nullable(z.string()),
		notes: z.nullable(z.string())
	})
);
type QueueItem = z.infer<typeof queueSchema>[number] & { shortName: string | null };

export const getQueueDescription = async (queueId: number) => {
	let queueData = await core.Cache.getByPrefix(QUEUE_DATA_CACHE_KEY) as QueueItem[] | undefined;
	if (!queueData) {
		const response = await core.Got.get("GenericAPI")({
			url: "https://static.developer.riotgames.com/docs/lol/queues.json"
		});

		const body = queueSchema.parse(response.body);
		queueData = body.map(i => ({
			...i,
			shortName: (i.description)
				? i.description.replace(/\s*\dv\d\s*/, "").replace(/\s*games\s*/, "")
				: null
		}));

		await core.Cache.setByPrefix(QUEUE_DATA_CACHE_KEY, queueData, {
			expiry: 14 * 864e5 // 14 days
		});
	}

	const queue = queueData.find(i => i.queueId === queueId);
	if (!queue) {
		throw new SupiError({
			message: "Queue ID not found"
		});
	}

	return queue;
};

export const getPlatform = (identifier: string) => {
	identifier = identifier.toLowerCase();

	for (const [platform, aliases] of typedEntries(PLATFORMS)) {
		if (identifier === platform || aliases.includes(identifier)) {
			return platform;
		}
	}

	return null;
};

const puuidSchema = z.object({ puuid: z.string() });
export const getPUUIDByName = async (gameName: string, tagLine: string) => {
	const key = getPUUIdCacheKey(gameName, tagLine);
	let puuid = await core.Cache.getByPrefix(key) as string | undefined;
	if (!puuid) {
		const response = await core.Got.get("GenericAPI")({
			url: `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${gameName}/${tagLine}`,
			throwHttpErrors: false,
			headers: {
				"X-Riot-Token": process.env.API_RIOT_GAMES_KEY
			}
		});

		if (response.statusCode === 404) {
			return null;
		}
		else if (!response.ok) {
			throw new SupiError({
				message: "Could not fetch PUUID",
				args: {
					statusCode: response.statusCode
				}
			});
		}

		puuid = puuidSchema.parse(response.body).puuid;

		await core.Cache.setByPrefix(key, puuid, {
			expiry: 30 * 864e5 // 30 days
		});
	}

	return puuid;
};

const leagueEntriesSchema = z.array(
	z.object({
		leagueId: z.string(),
		queueType: z.string(),
		tier: z.string(),
		rank: z.string(),
		puuid: z.string(),
		leaguePoints: z.number(),
		wins: z.number(),
		losses: z.number(),
		veteran: z.boolean(),
		inactive: z.boolean(),
		freshBlood: z.boolean(),
		hotStreak: z.boolean()
	})
);
export const getLeagueEntries = async (platform: string, puuid: string) => {
	const key = getLeagueEntriesCacheKey(platform, puuid);
	let data = await core.Cache.getByPrefix(key) as z.infer<typeof leagueEntriesSchema> | undefined;
	if (!data) {
		const response = await core.Got.get("GenericAPI")({
			url: `https://${platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`,
			headers: {
				"X-Riot-Token": process.env.API_RIOT_GAMES_KEY
			}
		});

		data = leagueEntriesSchema.parse(response.body);
		await core.Cache.setByPrefix(key, data, {
			expiry: 300_000 // 5 minutes
		});
	}

	return data;
};

type UserIdentifierFailure = { success: false, reply: string; };
type UserIdentifierSuccess = {
	success: true,
	puuid: string,
	gameName: string,
	tagLine: string,
	region: keyof typeof REGIONS
};

export const parseUserIdentifier = async (context: Context, regionName?: string, identifier?: string): Promise<UserIdentifierFailure | UserIdentifierSuccess> => {
	if (!regionName && !identifier) {
		const defaultRegion = await context.user.getDataProperty(DEFAULT_REGION_KEY);
		if (!defaultRegion) {
			return {
				success: false,
				reply: `You must provide the region!`
			};
		}

		regionName = defaultRegion;
	}
	else if (regionName && regionName.startsWith("@")) { // Check if the target is a user
		const targetUserData = await sb.User.get(regionName);
		if (!targetUserData) {
			return {
				success: false,
				reply: "Invalid user provided!"
			} as const;
		}

		const [defaultRegion, defaultIdentifier] = await Promise.all([
			targetUserData.getDataProperty(DEFAULT_REGION_KEY),
			targetUserData.getDataProperty(DEFAULT_USER_IDENTIFIER_KEY)
		]);
		if (!defaultRegion || !defaultIdentifier) {
			return {
				success: false,
				reply: `In order to check someone else's League stats, they must have both the default region and username set up!`
			} as const;
		}

		regionName = defaultRegion;
		identifier = defaultIdentifier;
	}

	if (!identifier) {
		const defaultIdentifier = await context.user.getDataProperty(DEFAULT_USER_IDENTIFIER_KEY);
		if (!defaultIdentifier) {
			return {
				success: false,
				reply: `You must provide the user identifier!`
			} as const;
		}

		identifier = defaultIdentifier;
	}

	if (!regionName) {
		throw new SupiError({
		    message: "Assert error: Region name not obtained"
		});
	}

	const region = getPlatform(regionName);
	if (!region) {
		return {
			success: false,
			reply: `Invalid region provided!`
		} as const;
	}

	let gameName;
	let tagLine;
	if (identifier.includes("#")) {
		[gameName, tagLine] = identifier.split("#");
	}
	else {
		gameName = identifier;
		tagLine = regionName;
	}

	const puuid = await getPUUIDByName(gameName, tagLine);
	if (!puuid) {
		return {
			success: false,
			reply: `No such user exists!`
		};
	}

	return {
		success: true,
		puuid,
		gameName,
		tagLine,
		region
	};
};

const matchIdSchema = z.array(z.string());
export const getMatchIds = async (platform: keyof typeof REGIONS, puuid: string, options: { count?: number } = {}) => {
	const summonerMatchKey = getMatchIdsKey(puuid);
	let matchIds = await core.Cache.getByPrefix(summonerMatchKey) as string[] | undefined;
	if (!matchIds) {
		const searchParams = new URLSearchParams({
			count: String(options.count ?? 20)
		});

		const region = REGIONS[platform];
		const response = await core.Got.get("GenericAPI")({
			url: `https://${region}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids`,
			throwHttpErrors: false,
			headers: {
				"X-Riot-Token": process.env.API_RIOT_GAMES_KEY
			},
			searchParams
		});

		if (!response.ok) {
			throw new SupiError({
				message: "Could not fetch match IDs",
				args: {
					statusCode: response.statusCode
				}
			});
		}

		matchIds = matchIdSchema.parse(response.body);
		await core.Cache.setByPrefix(summonerMatchKey, matchIds, {
			expiry: 300_000 // 5 minutes
		});
	}

	return matchIds;
};

const matchDataSchema = z.object({
	info: z.object({
		endOfGameResult: z.string(),
		gameDuration: z.int(),
		gameEndTimestamp: z.int(),
		gameId: z.int(),
		gameMode: z.string(),
		gameStartTimestamp: z.int(),
		gameType: z.string(),
		gameVersion: z.string(),
		participants: z.array(
			z.object({
				assists: z.int(),
				championName: z.string(),
				deaths: z.int(),
				kills: z.int(),
				neutralMinionsKilled: z.int(),
				puuid: z.string(),
				teamPosition: z.enum(typedKeys(TEAM_POSITIONS_MAP)),
				totalMinionsKilled: z.int(),
				win: z.boolean()
			}) // @todo: maybe add loose object or list out more interesting properties for custom usage
		),
		queueId: z.number()
	})
});
type MatchData = z.infer<typeof matchDataSchema>;

export const getMatchData = async (platform: keyof typeof REGIONS, matchId: string) => {
	const matchDataKey = getMatchDataKey(matchId);
	let matchData = await core.Cache.getByPrefix(matchDataKey) as MatchData | undefined;
	if (!matchData) {
		const region = REGIONS[platform];
		const response = await core.Got.get("GenericAPI")({
			url: `https://${region}.api.riotgames.com/lol/match/v5/matches/${matchId}`,
			throwHttpErrors: false,
			headers: {
				"X-Riot-Token": process.env.API_RIOT_GAMES_KEY
			}
		});

		if (!response.ok) {
			throw new SupiError({
				message: "Could not fetch match data",
				args: {
					statusCode: response.statusCode
				}
			});
		}

		matchData = matchDataSchema.parse(response.body);

		// Only cache matches that are finished
		if (matchData.info.endOfGameResult === GAME_RESULT.END) {
			await core.Cache.setByPrefix(matchDataKey, matchData, {
				expiry: 30 * 864e5 // 30 days
			});
		}
	}

	return matchData;
};

export default {
	NON_STANDARD_CHAMPION_NAMES, // @todo replace by a DataDragon API call in production: https://ddragon.leagueoflegends.com/cdn/14.11.1/data/en_US/champion.json
	DEFAULT_USER_IDENTIFIER_KEY,
	DEFAULT_REGION_KEY,
	GAME_RESULT,
	TEAM_POSITIONS_MAP,
	getQueueDescription,
	getPlatform,
	getPUUIDByName,
	getLeagueEntries,
	getMatchIds,
	getMatchData,
	parseUserIdentifier
};
