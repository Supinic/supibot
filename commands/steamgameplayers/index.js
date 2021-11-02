module.exports = {
	Name: "steamgameplayers",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "Searches for a Steam game, and attempts to find its current player amount.",
	Flags: ["mention","pipe","skip-banphrase"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function steamGamePlayers (context, ...args) {
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
				"x-algolia-application-id": "94HE6YATEI",
				"x-algolia-api-key": "4e93170f248c58869d226a339bd6a52c",
				hitsPerPage: 25,
				attributesToSnippet: "null",
				attributesToHighlight: "null",
				attributesToRetrieve: "name,developer",
				facetFilters: "appType:Game",
				query
			},
			headers: {
				Referer: "https://steamdb.info/"
			}
		});

		const { hits } = searchResponse.body;
		if (hits.length === 0) {
			return {
				success: false,
				reply: `No game found for your query!`
			};
		}

		const [game] = hits;
		const steamResponse = await sb.Got("GenericAPI", {
			url: "https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v0001",
			searchParams: {
				appid: game.objectID
			}
		});

		const players = steamResponse.body.response.player_count;
		let publisher = "";
		if (game.developer.length === 1) {
			publisher = `(by ${game.publisher[0]})`;
		}
		else if (game.developer.length > 1) {
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
	Dynamic_Description: null
};
