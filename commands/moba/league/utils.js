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
const REGIONS = {
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

const GAME_RESULT = {
	END: "GameComplete"
};

const NON_STANDARD_CHAMPION_NAMES = {
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

const DEFAULT_USER_IDENTIFIER_KEY = "leagueDefaultUserIdentifier";
const DEFAULT_REGION_KEY = "leagueDefaultRegion";
const QUEUE_DATA_CACHE_KEY = "league-queues-data";

const TEAM_POSITIONS_MAP = {
	TOP: "top",
	MIDDLE: "mid",
	JUNGLE: "jungle",
	BOTTOM: "ADC",
	UTILITY: "support"
};

const getQueueDescription = async (queueId) => {
	let queueData = await sb.Cache.getByPrefix(QUEUE_DATA_CACHE_KEY);
	if (!queueData) {
		const response = await sb.Got.get("GenericAPI")({
			url: "https://static.developer.riotgames.com/docs/lol/queues.json"
		});

		queueData = response.body;
		await sb.Cache.setByPrefix(QUEUE_DATA_CACHE_KEY, queueData, {
			expiry: 14 * 864e5 // 14 days
		});
	}

	const queue = queueData.find(i => i.queueId === queueId);
	if (!queue) {
		throw new sb.Error({
			messsage: "Queue ID not found"
		});
	}

	return queue;
};

const getPUUIdCacheKey = (gameName, tagLine) => `moba-league-puuid-${gameName}-${tagLine}`;
const getSummonerIdCacheKey = (puuid) => `moba-league-sid-${puuid}`;
const getLeagueEntriesCacheKey = (platform, summonerId) => `moba-league-entries-${platform}-${summonerId}`;
const getMatchIdsKey = (summonerId) => `moba-league-match-ids-${summonerId}`;
const getMatchDataKey = (matchId) => `moba-league-match-data-${matchId}`;

const getPlatform = (identifier) => {
	identifier = identifier.toLowerCase();

	for (const [platform, aliases] of Object.entries(PLATFORMS)) {
		if (identifier === platform || aliases.includes(identifier)) {
			return platform;
		}
	}

	return null;
};

const getPUUIDByName = async (gameName, tagLine) => {
	const key = getPUUIdCacheKey(gameName, tagLine);
	let puuid = await sb.Cache.getByPrefix(key);
	if (!puuid) {
		const response = await sb.Got.get("GenericAPI")({
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
			throw new sb.Error({
				message: "Could not fetch PUUID",
				args: {
					statusCode: response.statusCode
				}
			});
		}

		puuid = response.body.puuid;

		await sb.Cache.setByPrefix(key, puuid, {
			expiry: 30 * 864e5 // 30 days
		});
	}

	return puuid;
};

const getSummonerId = async (platform, puuid) => {
	const summonerKey = getSummonerIdCacheKey(puuid);
	let summonerId = await sb.Cache.getByPrefix(summonerKey);
	if (!summonerId) {
		const response = await sb.Got.get("GenericAPI")({
			url: `https://${platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`,
			throwHttpErrors: false,
			headers: {
				"X-Riot-Token": process.env.API_RIOT_GAMES_KEY
			}
		});

		if (response.statusCode === 404) {
			return null;
		}
		else if (!response.ok) {
			throw new sb.Error({
				message: "Could not fetch SID",
				args: {
					statusCode: response.statusCode
				}
			});
		}

		summonerId = response.body.id;
		await sb.Cache.setByPrefix(summonerKey, summonerId, {
			expiry: 30 * 864e5 // 30 days
		});
	}

	return summonerId;
};

const getLeagueEntries = async (platform, summonerId) => {
	const key = getLeagueEntriesCacheKey(platform, summonerId);
	let data = await sb.Cache.getByPrefix(key);
	if (!data) {
		const response = await sb.Got.get("GenericAPI")({
			url: `https://${platform}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}`,
			headers: {
				"X-Riot-Token": process.env.API_RIOT_GAMES_KEY
			}
		});

		data = response.body;
		await sb.Cache.setByPrefix(key, data, {
			expiry: 300_000 // 5 minutes
		});
	}

	return data;
};

const parseUserIdentifier = async (context, regionName, identifier) => {
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
	else if (regionName.startsWith("@")) { // Check if the target is a user
		const targetUserData = await sb.User.get(regionName);
		if (!targetUserData) {
			return {
				reply: "Invalid user provided!"
			};
		}

		const [defaultRegion, defaultIdentifier] = await Promise.all([
			targetUserData.getDataProperty(DEFAULT_REGION_KEY),
			targetUserData.getDataProperty(DEFAULT_USER_IDENTIFIER_KEY)
		]);
		if (!defaultRegion || !defaultIdentifier) {
			return {
				success: false,
				reply: `In order to check someone else's League stats, they must have both the default region and username set up!`
			};
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
			};
		}

		identifier = defaultIdentifier;
	}

	const region = getPlatform(regionName);
	if (!region) {
		return {
			success: false,
			reply: `Invalid region provided!`
		};
	}

	let gameName;
	let tagLine;
	if (identifier.includes("#")) {
		[gameName, tagLine] = identifier.split("#");
	}
	else {
		gameName = identifier;
		tagLine = region;
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

/**
 * @param {string} platform
 * @param {string} puuid
 * @param {Object} [options]
 * @param {number} [options.count]
 */
const getMatchIds = async (platform, puuid, options = {}) => {
	const summonerMatchKey = getMatchIdsKey(puuid);
	let matchIds = await sb.Cache.getByPrefix(summonerMatchKey);
	if (!matchIds) {
		const searchParams = new URLSearchParams({
			count: options.count ?? 20
		});

		const region = REGIONS[platform];
		const response = await sb.Got.get("GenericAPI")({
			url: `https://${region}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids`,
			throwHttpErrors: false,
			headers: {
				"X-Riot-Token": process.env.API_RIOT_GAMES_KEY
			},
			searchParams
		});

		if (!response.ok) {
			throw new sb.Error({
				message: "Could not fetch match IDs",
				args: {
					statusCode: response.statusCode
				}
			});
		}

		matchIds = response.body;
		await sb.Cache.setByPrefix(summonerMatchKey, matchIds, {
			expiry: 300_000 // 5 minutes
		});
	}

	return matchIds;
};

const getMatchData = async (platform, matchId) => {
	const matchDataKey = getMatchDataKey(matchId);
	let matchData = await sb.Cache.getByPrefix(matchDataKey);
	if (!matchData) {
		const region = REGIONS[platform];
		const response = await sb.Got.get("GenericAPI")({
			url: `https://${region}.api.riotgames.com/lol/match/v5/matches/${matchId}`,
			throwHttpErrors: false,
			headers: {
				"X-Riot-Token": process.env.API_RIOT_GAMES_KEY
			}
		});

		if (!response.ok) {
			throw new sb.Error({
				message: "Could not fetch match data",
				args: {
					statusCode: response.statusCode
				}
			});
		}

		matchData = response.body;

		// Only cache matches that are finished
		if (matchData.info.endOfGameResult === GAME_RESULT.END) {
			await sb.Cache.setByPrefix(matchDataKey, matchData, {
				expiry: 30 * 864e5 // 30 days
			});
		}
	}

	return matchData;
};

module.exports = {
	NON_STANDARD_CHAMPION_NAMES, // @todo replace by a DataDragon API call in production: https://ddragon.leagueoflegends.com/cdn/14.11.1/data/en_US/champion.json
	DEFAULT_USER_IDENTIFIER_KEY,
	DEFAULT_REGION_KEY,
	GAME_RESULT,
	TEAM_POSITIONS_MAP,
	getQueueDescription,
	getPlatform,
	getPUUIDByName,
	getSummonerId,
	getLeagueEntries,
	getMatchIds,
	getMatchData,
	parseUserIdentifier
};
