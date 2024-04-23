const idRegex = /"x-algolia-application-id"\s*:\s*"(.+?)"/;
const keyRegex = /\[atob\("eC1hbGdvbGlhLWFwaS1rZXk="\)]=atob\("(.+?)"\)/;

const refetchAlgoliaInfo = async () => {
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
		url: "https://steamdb.info/static/js/global.js",
		responseType: "text"
	});
	if (!response.ok) {
		return {
			success: false
		};
	}

	const idMatch = response.body.match(idRegex);
	const keyMatch = response.body.match(keyRegex);
	if (!idMatch || !keyMatch) {
		return {
			success: false
		};
	}

	const appID = idMatch[1];
	const apiKey = Buffer.from(keyMatch[1], "base64").toString("utf8");

	await Promise.all([
		sb.Config.set("ALGOLIA_STEAMDB_APP_ID", appID),
		sb.Config.set("ALGOLIA_STEAMDB_API_KEY", apiKey)
	]);

	return {
		success: true,
		appID,
		apiKey
	};
};

module.exports = {
	Name: "steamgameplayers",
	Aliases: ["sgp"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Searches for a Steam game, and attempts to find its current player amount.",
	Flags: ["mention","pipe"],
	Params: [
		{ name: "gameID", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: async function steamGamePlayers (context, ...args) {
		if (context.params.gameID) {
			const gameID = Number(context.params.gameID);
			if (!sb.Utils.isValidInteger(gameID)) {
				return {
					success: false,
					reply: `Invalid game ID provided!`
				};
			}

			const response = await sb.Got("GenericAPI", {
				url: "https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1",
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
			const result = await refetchAlgoliaInfo();
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

		// Ignore heuristics for now, Algolia API does not include game name
		const game = hits[0];
		const steamResponse = await sb.Got("GenericAPI", {
			url: "https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v0001",
			throwHttpErrors: false,
			searchParams: {
				appid: game.objectID,
				key: sb.Config.get("API_STEAM_KEY")
			}
		});

		if (steamResponse.statusCode !== 200) {
			return {
				success: false,
				reply: "Could not find any data regarding this game's current player count! This is probably on Steam's end."
			};
		}

		// Could add more game IDs to do some proper string matching later
		const gameDataResponse = await sb.Got("GenericAPI", {
			url: "https://store.steampowered.com/api/appdetails",
			throwHttpErrors: false,
			searchParams: {
				appids: game.objectID
			}
		});

		let publisher = "";
		const gameData = gameDataResponse.body[game.objectID].data;
		if (Array.isArray(gameData.publishers)) {
			if (gameData.publishers.length === 1) {
				publisher = `(by ${gameData.publishers[0]})`;
			}
			else if (game.publisher.length > 1) {
				publisher = `(by ${gameData.publishers[0]} and others)`;
			}
		}

		const players = steamResponse.body.response.player_count;
		return {
			reply: sb.Utils.tag.trim `
				${gameData.name} ${publisher}
				currently has
				${sb.Utils.groupDigits(players)}
				players in-game.			
			`
		};
	},
	Dynamic_Description: async () => [
		"Fetches the current amount of players for a specific Steam game.",
		"",

		`<code>$sgp (game name)</code>`,
		"Fetches game data by its name",
		"",


		`<code>$sgp gameID:(game ID)</code>`,
		"Fetches game data by its Steam ID",
		""
	]
};
