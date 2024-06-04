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

const getPUUIdCacheKey = (gameName, tagLine) => `moba-league-puuid-${gameName}-${tagLine}`;
const getSummonerIdCacheKey = (puuid) => `moba-league-sid-${puuid}`;
const getLeagueEntriesCacheKey = (platform, summonerId) => `mob-league-entries-${platform}-${summonerId}`;

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
		})
	}

	return puuid;
};

const getSummonerID = async (platform, puuid) => {
	const summonerKey = getSummonerIdCacheKey(puuid);
	let summonerId = await sb.Cache.getByPrefix(puuid);
	if (!summonerId) {
		const response = await sb.Got("GenericAPI", {
			url: `https://${platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`,
			throwHttpErrors: false,
			headers: {
				"X-Riot-Token": `${sb.Config.get("API_RIOT_GAMES_KEY")}`
			}
		});

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

module.exports = {
	getPlatform,
	getPUUIDByName,
	getSummonerID,
	getLeagueEntries
};
