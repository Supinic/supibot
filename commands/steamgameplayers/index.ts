import { CronJob } from "cron";
import { SupiDate, SupiError } from "supi-core";
import * as z from "zod";

import { declare } from "../../classes/command.js";

const SteamAppSchema = z.object({
	apps: z.array(
		z.object({
			appid: z.int(),
			last_modified: z.int(),
			name: z.string(),
			price_change_number: z.int()
		})
	),
	have_more_results: z.boolean(),
	last_appid: z.int()
});
const fetchGamesData = async () => {
	let lastUpdate = await core.Cache.getByPrefix("latest-steam-games-update") as number | undefined;
	if (!lastUpdate) {
		lastUpdate = new SupiDate().addHours(-24).getTime() / 1000;
	}

	const response = await core.Got.get("GenericAPI")({
		url: "https://api.steampowered.com/IStoreService/GetAppList/v1/",
		throwHttpErrors: false,
		searchParams: {
			if_modified_since: lastUpdate,
			include_games: true,
			max_results: 10_000,
			key: process.env.API_STEAM_KEY
		}
	});

	const { apps } = SteamAppSchema.parse(response.body);
	await core.Cache.setByPrefix("latest-steam-games-update", SupiDate.now() / 1000);

	for (const game of apps) {
		const row = await core.Query.getRow("data", "Steam_Game");
		await row.load(game.appid, true);
		if (row.loaded && game.name === row.values.Name) {
			continue;
		}

		row.setValues({
			ID: game.appid,
			Name: game.name
		});

		await row.save({ skipLoad: true });
	}
};

// Currently unused
/*
const SteamReviewSchema = z.object({
	query_summary: z.object({
		num_reviews: z.int().min(0),
		review_score: z.int().min(0),
		total_negative: z.int().min(0),
		total_positive: z.int().min(0),
		total_reviews: z.int().min(0),
		review_score_desc: z.string()
	})
});
const fetchReviewData = async (gameId: string | number) => {
	const response = await core.Got.get("GenericAPI")({
		url: `https://store.steampowered.com/appreviews/${gameId}`,
		searchParams: {
			json: "1",
			filter: "all",
			language: "all"
		}
	});

	let reviewsString;
	if (response.ok) {
		const { query_summary: summary } = SteamReviewSchema.parse(response.body);
		if (summary.total_reviews > 0) {
			const score = core.Utils.round(summary.total_positive / summary.total_reviews * 100, 1);
			reviewsString = `Rating: ${summary.review_score_desc} (${score}% positive)`;
		}
		else {
			reviewsString = `Rating: ${summary.review_score_desc}`;
		}
	}
	else {
		reviewsString = "Could not fetch reviews data";
	}

	return {
		result: reviewsString
	};
};
*/

const SteamRecommendationSchema = z.object({
	success: z.union([z.literal(0), z.literal(1)]),
	results: z.object({
		rollups: z.array(
			z.object({
				recommendations_up: z.int().min(0),
				recommendations_down: z.int().min(0)
			})
		)
	}).optional()
});
const fetchRecommendationData = async (gameId: string | number) => {
	const response = await core.Got.get("GenericAPI")({
		url: `https://store.steampowered.com/appreviewhistogram/${gameId}`
	});

	const { success, results } = SteamRecommendationSchema.parse(response.body);
	if (!response.ok || success !== 1) {
		return {
			result: "Could not fetch reviews data!"
		};
	}
	else if (!results) {
		return {
			result: "This game has no reviews!"
		};
	}

	let up = 0;
	let down = 0;
	for (const item of results.rollups) {
		up += item.recommendations_up;
		down += item.recommendations_down;
	}

	if ((up + down) === 0) {
		return {
			result: "This game has no reviews with ratings!"
		};
	}

	const value = core.Utils.round(up / (up + down) * 100, 2);
	return {
		result: `Rating: ${value}%`
	};
};

const SteamPlayerCountSchema = z.object({
	response: z.object({
		player_count: z.number().min(0)
	})
});

const SteamGameDataSchema = z.record(
	z.string(),
	z.object({
		success: z.boolean(),
		data: z.object({
			name: z.string(),
			developers: z.array(z.string())
		})
	}).optional()
);

let updateCronJob: CronJob | null = null;
export default declare({
	Name: "steamgameplayers",
	Aliases: ["sgp"],
	Cooldown: 5000,
	Description: "Searches for a Steam game, and attempts to find its current player amount.",
	Flags: ["mention","pipe"],
	Params: [
		{ name: "gameID", type: "number" },
		{ name: "skipReviews", type: "boolean" }
	] as const,
	Whitelist_Response: null,
	initialize: function () {
		updateCronJob = new CronJob("0 0 * * * *", () => fetchGamesData());
		updateCronJob.start();
	},
	destroy: function () {
		void updateCronJob?.stop();
		updateCronJob = null;
	},
	Code: async function steamGamePlayers (context, ...args) {
		if (!process.env.API_STEAM_KEY) {
			throw new SupiError({
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
				const plausibleResults = await core.Query.getRecordset<{ ID: number, Name: string }[]>(rs => {
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
				const matchResult = core.Utils.selectClosestString(gameName, plausibleNames, {
					ignoreCase: true,
					fullResult: true
				});
				if (!matchResult || matchResult.length === 0) {
					throw new SupiError({
					    message: "Assert error: Queried Steam game not found by string"
					});
				}

				const [bestMatch] = matchResult;
				const foundGame = (
					plausibleResults.find(i => i.Name === gameName) // Try and find the case identical to user input first
					?? plausibleResults.find(i => i.Name === bestMatch.original) // default to best match second
				);

				if (!foundGame) {
					throw new SupiError({
						message: "Assert error: Queried Steam game not found by results"
					});
				}

				gameId = foundGame.ID;
			}
		}

		const playerCountResponse = await core.Got.get("GenericAPI")({
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

		const { response: playerCountData } = SteamPlayerCountSchema.parse(playerCountResponse.body);
		const gameDataResponse = await core.Got.get("GenericAPI")({
			url: "https://store.steampowered.com/api/appdetails",
			throwHttpErrors: false,
			searchParams: {
				appids: gameId
			}
		});

		const gameSchema = SteamGameDataSchema.parse(gameDataResponse.body)[gameId];
		if (!gameSchema || !gameSchema.success) {
			return {
				success: false,
				reply: "This Steam game supposedly exists, but there is no data associated with it!"
			};
		}

		const { data: gameData } = gameSchema;
		let publisher = "";
		const devs = gameData.developers;
		if (Array.isArray(devs)) {
			if (devs.length === 1) {
				publisher = `(by ${devs[0]})`;
			}
			else if (devs.length > 1) {
				publisher = `(by ${devs[0]} and others)`;
			}
		}

		let reviewsString = "";
		if (!context.params.skipReviews) {
			const { result } = await fetchRecommendationData(gameId);
			reviewsString = result;
		}

		const steamLink = `https://store.steampowered.com/app/${gameId}`;
		return {
			reply: core.Utils.tag.trim `
				${gameData.name} ${publisher}
				currently has
				${core.Utils.groupDigits(playerCountData.player_count)}
				players in-game.
				${reviewsString}	
				${steamLink}	
			`
		};
	},
	Dynamic_Description: (prefix) => [
		"Fetches the current amount of players for a specific Steam game.",
		"",

		`<code>${prefix}steamgameplayers Counter Strike</code>`,
		`<code>${prefix}sgp (game name)</code>`,
		`<code>${prefix}sgp Counter Strike</code>`,
		"Fetches game data by its name",
		"",

		`<code>${prefix}sgp (steam store URL)</code>`,
		`<code>${prefix}sgp https://store.steampowered.com/app/105600/Terraria</code>`,
		"Fetches game data by its Steam Store URL (and some others too possibly)",
		"",

		`<code>${prefix}sgp gameID:(game ID)</code>`,
		`<code>${prefix}sgp gameID:12345</code>`,
		"Fetches game data by its Steam ID",
		"",

		`<code>${prefix}sgp skipReviews:true (game)</code>`,
		"If provided with the <code>skipReviews</code> parameter, the command will not show the game's reviews score."
	]
});
