module.exports = {
	Name: "steamgameplayers",
	Aliases: ["sgp"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Searches for a Steam game, and attempts to find its current player amount.",
	Flags: ["mention","pipe","use-params"],
	Params: [
		{ name: "gameID", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: (() => ({
		refetchAlgoliaInfo: async () => {
			let configRowsAdded = false;
			if (!sb.Config.has("ALGOLIA_STEAMDB_APP_ID", false)) {
				const row = await sb.Query.getRow("data", "Config");
				row.setValues({
					Name: "ALGOLIA_STEAMDB_APP_ID",
					Type: "string",
					Editable: true
				});

				await row.save({ skipLoad: true });
				configRowsAdded = true;
			}
			if (!sb.Config.has("ALGOLIA_STEAMDB_API_KEY", false)) {
				const row = await sb.Query.getRow("data", "Config");
				row.setValues({
					Name: "ALGOLIA_STEAMDB_API_KEY",
					Type: "string",
					Editable: true
				});

				await row.save({ skipLoad: true });
				configRowsAdded = true;
			}

			if (configRowsAdded) {
				await sb.Config.reloadData();
			}

			const response = await sb.Got("FakeAgent", {
				url: "https://steamdb.info/static/js/instantsearch.js",
				responseType: "text"
			});

			if (response.statusCode !== 200) {
				return {
					success: false
				};
			}

			const match = response.body.match(/algoliasearch\("(.*?)"\s*,\s*"(.*?)"/);
			const appID = match[1];
			const apiKey = match[2];

			await Promise.all([
				sb.Config.set("ALGOLIA_STEAMDB_APP_ID", appID),
				sb.Config.set("ALGOLIA_STEAMDB_API_KEY", apiKey)
			]);

			return {
				success: true
			};
		}
	})),
	Code: (async function steamGamePlayers (context, ...args) {
		if (context.params.gameID) {
			const gameID = Number(context.params.gameID);
			if (!sb.Utils.isValidInteger(gameID)) {
				return {
					success: false,
					reply: `Invalid game ID provided!`
				};
			}

			const response = await sb.Got("GenericAPI", {
				url: "https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v0001",
				searchParams: {
					appid: context.params.gameID
				}
			});

			if (response.statusCode === 404) {
				return {
					success: false,
					reply: `No game exists for provided ID!`
				};
			}

			const players = response.body.response.player_count;
			return {
				reply: `That game currently has ${sb.Utils.groupDigits(players)} players in-game.`
			};
		}

		const query = args.join(" ");
		if (!query) {
			return {
				success: false,
				reply: `No game name provided!`
			};
		}

		const searchResponse = await sb.Got("FakeAgent", {
			url: "https://94he6yatei-dsn.algolia.net/1/indexes/steamdb",
			searchParams: {
				"x-algolia-agent": "SteamDB+Autocompletion",
				"x-algolia-application-id": sb.Config.get("ALGOLIA_STEAMDB_APP_ID", false),
				"x-algolia-api-key": sb.Config.get("ALGOLIA_STEAMDB_API_KEY", false),
				hitsPerPage: 50,
				attributesToSnippet: "null",
				attributesToHighlight: "null",
				attributesToRetrieve: "name,publisher",
				facetFilters: "appType:Game",
				query
			},
			headers: {
				Referer: "https://steamdb.info/"
			}
		});

		if (searchResponse.statusCode !== 200) {
			const result = await this.staticData.refetchAlgoliaInfo();
			if (result.success) {
				return {
					reply: `Could not fetch game data. I tried to fix it, and it seems to be okay now. Try again, please? 😊`
				};
			}
			else {
				return {
					success: false,
					reply: `Could not fetch game data! The source site is probably broken 😟`
				};
			}
		}

		const { hits } = searchResponse.body;
		if (hits.length === 0) {
			return {
				success: false,
				reply: `No game found for your query!`
			};
		}

		// attempt to find an exact match by game name
		let game = hits.find(i => i.name.toLowerCase() === query.toLowerCase());
		if (!game) {
			game = hits[0];
		}

		const steamResponse = await sb.Got("GenericAPI", {
			url: "https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v0001",
			searchParams: {
				appid: game.objectID
			}
		});

		const players = steamResponse.body.response.player_count;
		let publisher = "";
		if (game.publisher.length === 1) {
			publisher = `(by ${game.publisher[0]})`;
		}
		else if (game.publisher.length > 1) {
			publisher = `(by ${game.publisher[0]} and others)`;
		}

		return {
			reply: sb.Utils.tag.trim `
				${game.name} ${publisher}
				currently has
				${sb.Utils.groupDigits(players)}
				players in-game.			
			`
		};
	}),
	Dynamic_Description: (async (prefix) => [
		"Fetches the current amount of players for a specific Steam game.",
		"",

		`<code>${prefix}sgp (game name)</code>`,
		"Fetches game data by its name",
		"",


		`<code>${prefix}sgp gameID:(game ID)</code>`,
		"Fetches game data by its Steam ID",
		""
	])
};
