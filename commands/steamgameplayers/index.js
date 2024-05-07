const { CronJob } = require("cron");

const fetchGamesData = async () => {
	let lastUpdate = await sb.Cache.getByPrefix("latest-steam-games-update");
	if (!lastUpdate) {
		lastUpdate = new sb.Date().addHours(-24).getTime() / 1000;
	}

	const response = await sb.Got("GenericAPI", {
		url: "https://api.steampowered.com/IStoreService/GetAppList/v1/",
		throwHttpErrors: false,
		searchParams: {
			if_modified_since: lastUpdate,
			include_games: true,
			max_results: 10_000,
			key: sb.Config.get("API_STEAM_KEY")
		}
	});

	await sb.Cache.setByPrefix("latest-steam-games-update", sb.Date.now() / 1000);

	for (const game of response.body.response.apps) {
		const row = await sb.Query.getRow("data", "Steam_Game");
		await row.load(game.appid, true);
		if (row.loaded) {
			continue;
		}

		row.setValues({
			ID: game.appid,
			Name: game.name
		});

		await row.save({ skipLoad: true });
	}
};

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
	initialize: function () {
		this.data.updateCronJob = new CronJob("0 0 * * * *", () => fetchGamesData());
		this.data.updateCronJob.start();
	},
	destroy: function () {
		this.data.updateCronJob.stop();
		this.data.updateCronJob = null;
	},
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

			const gameName = args.join(" ");
			const plausibleNames = plausibleResults.map(i => i.Name);
			const [bestMatch] = sb.Utils.selectClosestString(gameName, plausibleNames, {
				ignoreCase: true,
				fullResult: true
			});

			gameId = plausibleResults.find(i => i.Name === bestMatch.original).ID;
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

		const gameDataResponse = await sb.Got("GenericAPI", {
			url: "https://store.steampowered.com/api/appdetails",
			throwHttpErrors: false,
			searchParams: {
				appids: gameId
			}
		});

		let publisher = "";
		const gameData = gameDataResponse.body[gameId].data;
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
