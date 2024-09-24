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
			key: process.env.API_STEAM_KEY
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
		{ name: "gameID", type: "number" },
		{ name: "skipReviews", type: "boolean" }
	],
	Whitelist_Response: null,
	initialize: function () {
		this.data.updateCronJob = new CronJob("0 0 * * * *", () => fetchGamesData());
		this.data.updateCronJob.start();
	},
	destroy: function () {
		this.data.updateCronJob.stop();
		this.data.updateCronJob = null;
	},
	Code: async function steamGamePlayers (context, ...args) {
		if (!process.env.API_CRYPTO_COMPARE) {
			throw new sb.Error({
				message: "No Steam key configured (API_STEAM_KEY)"
			});
		}

		let gameId = context.params.gameID ?? null;
		const gameName = args.join(" ");
		if (!gameId) {
			if (!gameName) {
				return {
					success: false,
					reply: `No game provided!`
				};
			}

			const potentialUrlAppId = gameName.match(/app\/(\d+)/);
			if (potentialUrlAppId) {
				gameId = Number(potentialUrlAppId[1]);
			}
			else {
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

				if (plausibleResults.length === 0) {
					return {
						success: false,
						reply: `No games found for your query!`
					};
				}

				const plausibleNames = plausibleResults.map(i => i.Name);
				const [bestMatch] = sb.Utils.selectClosestString(gameName, plausibleNames, {
					ignoreCase: true,
					fullResult: true
				});

				gameId = plausibleResults.find(i => i.Name === bestMatch.original).ID;
			}
		}

		const playerCountResponse = await sb.Got("GenericAPI", {
			url: "https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v0001",
			throwHttpErrors: false,
			searchParams: {
				appid: gameId,
				key: process.env.API_STEAM_KEY
			}
		});

		if (!playerCountResponse.ok) {
			return {
				success: false,
				reply: "Could not find this Steam game!"
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
		if (!gameData) {
			return {
				success: false,
				reply: "This Steam game supposedly exists, but there is no data associated with it!"
			};
		}

		const devs = gameData.developers;
		if (Array.isArray(devs)) {
			if (devs.length === 1) {
				publisher = `(by ${devs[0]})`;
			}
			else if (devs > 1) {
				publisher = `(by ${devs[0]} and others)`;
			}
		}

		let reviewsString = "";
		if (!context.params.skipReviews) {
			const response = await sb.Got("GenericAPI", {
				url: `https://store.steampowered.com/appreviews/${gameId}`,
				searchParams: {
					json: "1",
					filter: "all",
					language: "all"
				}
			});

			if (response.ok) {
				const summary = response.body.query_summary;
				if (summary.total_reviews > 0) {
					const score = sb.Utils.round(summary.total_positive / summary.total_reviews * 100, 1);
					reviewsString = `Rating: ${summary.review_score_desc} (${score}% positive)`;
				}
				else {
					reviewsString = `Rating: ${summary.review_score_desc}`;
				}
			}
			else {
				reviewsString = "Could not fetch reviews data";
			}
		}

		const players = playerCountResponse.body.response.player_count;
		return {
			reply: sb.Utils.tag.trim `
				${gameData.name} ${publisher}
				currently has
				${sb.Utils.groupDigits(players)}
				players in-game.
				${reviewsString}		
			`
		};
	},
	Dynamic_Description: async () => [
		"Fetches the current amount of players for a specific Steam game.",
		"",

		`<code>$sgp (game name)</code>`,
		`<code>$sgp Counter Strike</code>`,
		"Fetches game data by its name",
		"",

		`<code>$sgp (steam store URL)</code>`,
		`<code>$sgp https://store.steampowered.com/app/105600/Terraria</code>`,
		"Fetches game data by its Steam Store URL (and some others too possibly)",
		"",

		`<code>$sgp gameID:(game ID)</code>`,
		`<code>$sgp gameID:12345</code>`,
		"Fetches game data by its Steam ID",
		"",

		`<code>$sgp skipReviews:true (game)</code>`,
		"If provided with the <code>skipReviews</code> parameter, the command will not show the game's reviews score.",
		""
	]
};
