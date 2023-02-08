module.exports = {
	Name: "howlongtobeat",
	Aliases: ["hltb"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "For a provided game, shows how long it takes to beat based on the https://howlongtobeat.com website's data.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function howLongToBeat (context, ...args) {
		if (args.length === 0) {
			return {
				success: false,
				reply: `No game name provided!`
			};
		}

		const response = await sb.Got("GenericAPI", {
			url: "https://howlongtobeat.com/api/search",
			method: "POST",
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
						gameplay: { perspective: "", flow: "", genre: "" },
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
