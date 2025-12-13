import * as z from "zod";
import { SupiDate } from "supi-core";
import { declare } from "../../classes/command.js";

const HLTB_TOKEN_CACHE_KEY = "hltb-token-cache";

const initSchema = z.object({ token: z.string() });
const hltbGameSchema = z.object({
	comp_100: z.number(),
	comp_100_count: z.number(),
	comp_all: z.number(),
	comp_all_count: z.number(),
	comp_lvl_co: z.number(),
	comp_lvl_combine: z.number(),
	comp_lvl_mp: z.number(),
	comp_lvl_sp: z.number(),
	comp_main: z.number(),
	comp_main_count: z.number(),
	comp_plus: z.number(),
	comp_plus_count: z.number(),
	count_backlog: z.number(),
	count_comp: z.number(),
	count_playing: z.number(),
	count_retired: z.number(),
	count_review: z.number(),
	count_speedrun: z.number(),
	game_alias: z.string(),
	game_id: z.number(),
	game_image: z.string(),
	game_name: z.string(),
	game_name_date: z.number(),
	game_type: z.string(),
	invested_co: z.number(),
	invested_co_count: z.number(),
	invested_mp: z.number(),
	invested_mp_count: z.number(),
	profile_platform: z.string(),
	profile_popular: z.number(),
	release_world: z.number(),
	review_score: z.number()
});
const hltbDataSchema = z.object({
	category: z.string(),
	color: z.string(),
	count: z.number(),
	data: z.array(hltbGameSchema),
	displayModifier: z.unknown(),
	pageCurrent: z.number(),
	pageSize: z.number(),
	pageTotal: z.number(),
	title: z.string(),
	userData: z.array(z.unknown())
});

/**
 * This comment chain is no longer relevant after the latest changes, made on 2025-11-17:
 *
 * // Need to fetch a randomized hash to attach to the ~~api/search~~ ~~api/find~~ ~~api/lookup~~ ~~api/s~~ ~~api/ouch~~ ~~api/seek~~ api/locate endpoint
 * // Reference: https://github.com/ScrappyCocco/HowLongToBeat-PythonAPI/issues/25
 * // Reference from `search` to `find`: https://github.com/ScrappyCocco/HowLongToBeat-PythonAPI/pull/35
 * // Reference from `find` to `lookup`: https://github.com/ScrappyCocco/HowLongToBeat-PythonAPI/pull/38
 */

/**
 * Fetches the "authentication token" - either from cache, or refreshes it.
 */
const fetchToken = async () => {
	const existing = await core.Cache.getByPrefix(HLTB_TOKEN_CACHE_KEY) as string | undefined;
	if (existing) {
		return existing;
	}

	const now = SupiDate.now();
	const response = await core.Got.get("FakeAgent")({
		url: `https://howlongtobeat.com/api/search/init?t=${now}`,
		responseType: "json",
		headers: {
			Referer: "https://howlongtobeat.com/"
		}
	});

	if (!response.ok) {
		return null;
	}

	const { token } = initSchema.parse(response.body);
	await core.Cache.setByPrefix(HLTB_TOKEN_CACHE_KEY, token, {
		expiry: 864e5 // 1 day
	});

	return token;
};

const fetchData = async (query: string[]) => {
	const token = await fetchToken();
	if (!token) {
		return {
			success: false,
			reply: "Could not fetch game data! The API has likely changed (again?!)"
		} as const;
	}

	const response = await core.Got.get("FakeAgent")({
		url: `https://howlongtobeat.com/api/search`,
		method: "POST",
		throwHttpErrors: false,
		headers: {
			Referer: "https://howlongtobeat.com",
			"X-Auth-Token": token
		},
		// All the default values (e.g. empty strings, nulls, zeroes) must be filled,
		// else the API fails with 500 Internal Server Error.
		json: {
			searchType: "games",
			searchTerms: [...query],
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

	return response;
};

export default declare({
	Name: "howlongtobeat",
	Aliases: ["hltb"],
	Cooldown: 5000,
	Description: "For a provided game, shows how long it takes to beat based on the https://howlongtobeat.com website's data.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: async function howLongToBeat (context, ...args) {
		if (args.length === 0) {
			return {
				success: false,
				reply: `No game name provided!`
			};
		}

		let response = await fetchData(args);
		if ("success" in response) {
			return response;
		}

		if (!response.ok) {
			await core.Cache.setByPrefix(HLTB_TOKEN_CACHE_KEY, null);
			response = await fetchData(args);

			if ("success" in response) {
				return response;
			}
			else if (!response.ok) {
				return {
				    success: false,
				    reply: "Could not fetch data after resetting the token! The API has likely changed (again?!)"
				};
			}
		}

		const { data } = hltbDataSchema.parse(response.body);
		if (data.length === 0) {
			return {
				success: false,
				reply: `No game has been found for your query!`
			};
		}

		const [gameData] = data;
		const hours = {
			main: core.Utils.round(gameData.comp_main / 3600, 1),
			plus: core.Utils.round(gameData.comp_plus / 3600, 1),
			full: core.Utils.round(gameData.comp_100 / 3600, 1),
			all: core.Utils.round(gameData.comp_all / 3600, 1)
		} as const;

		const url = `https://howlongtobeat.com/game/${gameData.game_id}`;
		const totalCheck = Object.values(hours).reduce((acc, cur) => acc + cur, 0);
		if (totalCheck === 0) {
			return {
			    success: true,
			    reply: core.Utils.tag.trim `
					${gameData.game_name} (${gameData.release_world})
					currently does not have any data about completion times. 
					${url}
				`
			};
		}

		return {
			success: true,
			reply: core.Utils.tag.trim `
				Average time to beat ${gameData.game_name} (${gameData.release_world}):
				Main story - ${hours.main} hours;
				Side content - ${hours.plus} hours;
				100% - ${hours.full} hours;
				All styles - ${hours.all} hours.
				${url}
			`
		};
	},
	Dynamic_Description: null
});
