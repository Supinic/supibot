const steamId64to32 = (steamId64) => (BigInt(steamId64) - BigInt("76561197960265728")).toString();
const steamId32to64 = (steamId32) => (BigInt(steamId32) + BigInt("76561197960265728")).toString();

const getSteamId = async (username) => {
	const response = await sb.Got("GenericAPI", {
		url: `https://steamid.xyz/${encodeURIComponent(username)}`,
		responseType: "text"
	});

	if (!response.ok) {
		return null;
	}

	const $ = sb.Utils.cheerio(response.body);
	const cell = $($("table td")[5]);
	const steamId32 = cell.text();
	if (!steamId32) {
		return null;
	}

	return steamId32;
};

// response.body.result = { count: number, heroes: Array<{name, id, localized_name}>
const getHeroes = async () => await sb.Got("GenericAPI", {
	url: "https://api.steampowered.com/IEconDOTA2_570/GetHeroes/v0001",
	searchParams: {
		key: sb.Config.get("API_STEAM_KEY"),
		language: "en"
	}
});

// 2024-06-19: currently broken xd
const getMatchDetails = async (matchId) => await sb.Got("GenericAPI", {
	url: "https://api.steampowered.com/IDOTA2Match_570/GetMatchDetails/V001",
	searchParams: {
		key: sb.Config.get("API_STEAM_KEY"),
		match_id: matchId
	}
});

/**
 * response.body.result = {
 *  matches: Array<{
 *    match_id: number;
 *    match_seq_num: number;
 *    start_time: number;
 *    players: Array<{
 *      account_id: number;
 *      hero_id: number;
 *      hero_variant: number;
 *      player_slot: number;
 *      team_number: number;
 *      team_slot: number;
 *    }>
 *  }>
 *  num_results: number;
 *  results_remaining: number;
 *  status: number;
 *  total_result: number;
 * }
 */
const getMatchHistory = async (accountId) => await sb.Got("GenericAPI", {
	url: "https://api.steampowered.com/IDOTA2Match_570/GetMatchHistory/V001",
	searchParams: {
		key: sb.Config.get("API_STEAM_KEY"),
		account_id: accountId
	}
});
