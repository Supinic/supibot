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
		const response = await sb.Got("GenericAPI", {
			url: `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${gameName}/${tagLine}`,
			throwHttpErrors: false,
			headers: {
				"X-Riot-Token": `${sb.Config.get("API_RIOT_GAMES_KEY")}`
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
		const response = await sb.Got("GenericAPI", {
			url: `https://${platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`,
			throwHttpErrors: false,
			headers: {
				"X-Riot-Token": `${sb.Config.get("API_RIOT_GAMES_KEY")}`
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
		const response = await sb.Got("GenericAPI", {
			url: `https://${platform}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}`,
			headers: {
				"X-Riot-Token": `${sb.Config.get("API_RIOT_GAMES_KEY")}`
			}
		});

		data = response.body;
		await sb.Cache.setByPrefix(key, data, {
			expiry: 300_000 // 5 minutes
		});
	}

	return data;
};

const parseUserIdentifier = async (regionName, identifier) => {
	if (!regionName || !identifier) {
		return {
			success: false,
			reply: `You must provide the region and the full user name!`
		};
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

/**
 * @param {string} puuid
 * @param {Object} [options]
 * @param {number} [options.count]
 */
const getMatchIds = async (puuid, options = {}) => {
	const summonerMatchKey = getMatchIdsKey(puuid);
	let matchIds = await sb.Cache.getByPrefix(summonerMatchKey);
	if (!matchIds) {
		const searchParams = new URLSearchParams({
			count: options.count ?? 20
		});

		const response = await sb.Got("GenericAPI", {
			url: `https://europe.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids`,
			throwHttpErrors: false,
			headers: {
				"X-Riot-Token": `${sb.Config.get("API_RIOT_GAMES_KEY")}`
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

const getMatchData = async (matchId) => {
	const matchDataKey = getMatchDataKey(matchId);
	let matchData = await sb.Cache.getByPrefix(matchDataKey);
	if (!matchData) {
		const response = await sb.Got("GenericAPI", {
			url: `https://europe.api.riotgames.com/lol/match/v5/matches/${matchId}`,
			throwHttpErrors: false,
			headers: {
				"X-Riot-Token": `${sb.Config.get("API_RIOT_GAMES_KEY")}`
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
	GAME_RESULT,
	getPlatform,
	getPUUIDByName,
	getSummonerId,
	getLeagueEntries,
	getMatchIds,
	getMatchData,
	parseUserIdentifier
};
