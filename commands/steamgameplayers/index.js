module.exports = {
	Name: "steamgameplayers",
	Aliases: ["sgp"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Searches for a Steam game, and attempts to find its current player amount.",
	Flags: ["mention","pipe"],
	Params: [
		{ name: "gameID", type: "number" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: async function steamGamePlayers (context, ...args) {
		let gameId = context.params.gameID ?? null;
		if (!gameId) {
			const plausibleResults = await sb.Query.getRecordset(rs => {
				rs.select("ID", "Name");
				rs.from("data", "Steam_Game");
				rs.limit(25);
				rs.orderBy("ID ASC");

				for (const word of args) {
					rs.where("Name %*like*", word);
				}

				return rs;
			});

			const bestMatch = sb.Utils.selectClosestString(args.join(" "), plausibleResults.map(i => i.Name));
			gameId = plausibleResults.find(i => i.name === bestMatch).ID;
		}

		const steamResponse = await sb.Got("GenericAPI", {
			url: "https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v0001",
			throwHttpErrors: false,
			searchParams: {
				appid: gameId,
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
		const devs = gameData.developers;

		if (Array.isArray(devs)) {
			if (devs.length === 1) {
				publisher = `(by ${devs[0]})`;
			}
			else if (devs > 1) {
				publisher = `(by ${devs[0]} and others)`;
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
