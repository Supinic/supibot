// Need to fetch a randomized hash to attach to the ~~api/search~~ ~~api/find~~ ~~api/lookup~~ api/s endpoint
// Reference: https://github.com/ScrappyCocco/HowLongToBeat-PythonAPI/issues/25
// Reference from `search` to `find`: https://github.com/ScrappyCocco/HowLongToBeat-PythonAPI/pull/35
// Reference from `find` to `lookup`: https://github.com/ScrappyCocco/HowLongToBeat-PythonAPI/pull/38
const HLTB_JS_FILE_HASH_KEY = "hltb-file-hash";
const HLTB_ENDPOINT_HASH_KEY = "hltb-endpoint-hash";

const FILE_PREFIX = "_next/static/chunks/pages";
const FILE_HASH_REGEX = /static\/chunks\/pages\/(_app-\w+?\.js)/;
const ENDPOINT_HASH_REGEX = /\/api\/s\/".concat\("(\w+)"\)\s*(.concat\("(\w+)"\))?/;

const fetchFileHash = async (force = false) => {
	const existing = await sb.Cache.getByPrefix(HLTB_JS_FILE_HASH_KEY);
	if (!force && existing) {
		return existing;
	}

	const response = await sb.Got.get("FakeAgent")({
		url: "https://howlongtobeat.com/",
		responseType: "text"
	});

	if (!response.ok) {
		return null;
	}

	const match = response.body.match(FILE_HASH_REGEX);
	if (!match) {
		return null;
	}

	await sb.Cache.setByPrefix(HLTB_JS_FILE_HASH_KEY, match[1], {
		expiry: 864e5 // 1 day
	});

	return match[1];
};

const fetchEndpointHash = async (fileHash, force = false) => {
	const existing = await sb.Cache.getByPrefix(HLTB_ENDPOINT_HASH_KEY);
	if (!force && existing) {
		return existing;
	}

	const response = await sb.Got.get("FakeAgent")({
		url: `https://howlongtobeat.com/${FILE_PREFIX}/${fileHash}`,
		responseType: "text"
	});

	if (!response.ok) {
		await sb.Cache.setByPrefix(HLTB_JS_FILE_HASH_KEY, null);
		return null;
	}

	const match = response.body.match(ENDPOINT_HASH_REGEX);
	if (!match) {
		return null;
	}

	const hash = (match[3]) ? `${match[1]}${match[3]}` : match[1];
	await sb.Cache.setByPrefix(HLTB_ENDPOINT_HASH_KEY, hash, {
		expiry: 864e5 // 1 day
	});

	return hash;
};

module.exports = {
	Name: "howlongtobeat",
	Aliases: ["hltb"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "For a provided game, shows how long it takes to beat based on the https://howlongtobeat.com website's data.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function howLongToBeat (context, ...args) {
		if (args.length === 0) {
			return {
				success: false,
				reply: `No game name provided!`
			};
		}

		const fileHash = await fetchFileHash();
		if (!fileHash) {
			return {
				success: false,
				reply: "Cannot fetch game data - file hash!"
			};
		}

		const endpointHash = await fetchEndpointHash(fileHash);
		if (!endpointHash) {
			return {
				success: false,
				reply: "Cannot fetch game data - endpoint hash!"
			};
		}

		const response = await sb.Got.get("FakeAgent")({
			url: `https://howlongtobeat.com/api/s/${endpointHash}`,
			method: "POST",
			throwHttpErrors: false,
			headers: {
				Referer: "https://howlongtobeat.com"
			},
			// All the default values (e.g. empty strings, nulls, zeroes) must be filled,
			// else the API fails with 500 Internal Server Error.
			json: {
				searchType: "games",
				searchTerms: [...args],
				searchPage: 1,
				searchOptions: {
					filter: "",
					games: {
						gameplay: {
							perspective: "",
							flow: "",
							genre: "",
							difficulty: ""
						},
						modifier: "",
						platform: "",
						rangeCategory: "main",
						rangeTime: { min: null, max: null },
						rangeYear: { min: "", max: "" },
						sortCategory: "popular",
						userId: 0
					},
					randomizer: 0,
					sort: 0
				},
				size: 1
			}
		});

		if (!response.ok) {
			await sb.Cache.setByPrefix(HLTB_ENDPOINT_HASH_KEY, null);
			return {
				success: false,
				reply: "Could not fetch game data! Resetting cache - try again, please."
			};
		}

		// 	main: gameData.comp_main_count,
		// 	plus: gameData.comp_plus_count,
		// 	full: gameData.comp_100_count,
		// 	all: gameData.comp_all_count
		const { data } = response.body;
		if (data.length === 0) {
			return {
				success: false,
				reply: `No game has been found for your query!`
			};
		}

		const [gameData] = data;
		const hours = {
			main: sb.Utils.round(gameData.comp_main / 3600, 1),
			plus: sb.Utils.round(gameData.comp_plus / 3600, 1),
			full: sb.Utils.round(gameData.comp_100 / 3600, 1),
			all: sb.Utils.round(gameData.comp_all / 3600, 1)
		};

		const url = `https://howlongtobeat.com/game/${gameData.game_id}`;
		return {
			reply: sb.Utils.tag.trim `
				Average time to beat ${gameData.game_name} (${gameData.release_world}):
				Main story - ${hours.main} hours;
				Side content - ${hours.plus} hours;
				100% - ${hours.full} hours;
				All styles - ${hours.all} hours.
				${url}
			`
		};
	}),
	Dynamic_Description: null
};
