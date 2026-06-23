import * as z from "zod";
import { SupiDate } from "supi-core";
import { declare } from "../../classes/command.js";
import { selectClosestObject } from "../../utils/command-utils.js";

type RunData = z.infer<typeof runsSchema>["data"]["runs"][number]["run"];

const makeCacheKey = (gameId: string, categoryId: string) => `speedrun-cached-game-${gameId}-${categoryId}`;
const gamesSchema = z.object({
	data: z.array(z.object({
		id: z.string(),
		names: z.object({ international: z.string() })
	}))
});
const categoriesSchema = z.object({
	data: z.array(z.object({
		id: z.string(),
		name: z.string()
	}))
});
const runsSchema = z.object({
	data: z.object({
		runs: z.array(z.object({
			run: z.object({
				id: z.string(),
				weblink: z.string(),
				players: z.array(z.object({
					id: z.string().optional()
				})),
				date: z.string().nullable(),
				times: z.object({
					primary_t: z.number()
				}),
				videos: z.object({
					links: z.array(z.object({
						uri: z.string()
					})).nullish()
				}).nullable()
			})
		}))
	})
});
const runnersSchema = z.object({
	data: z.object({
		names: z.object({ international: z.string() })
	})
});

export default declare({
	Name: "speedrun",
	Aliases: null,
	Cooldown: 10000,
	Description: "Fetches the current world record speedrun of a given name in the default category. Check extended help for more info.",
	Flags: ["mention", "non-nullable", "pipe"],
	Params: [{ name: "category", type: "string" }],
	Whitelist_Response: null,
	Code: (async function speedrun (context, ...args) {
		const name = args.join(" ");
		if (!name) {
			return {
				success: false,
				reply: "You did not provide a game name!"
			};
		}

		const searchResponse = await core.Got.get("GenericAPI")({
			url: "https://www.speedrun.com/api/v1/games",
			searchParams: { name }
		});

		const games = gamesSchema.parse(searchResponse.body).data;
		const game = selectClosestObject(name, games, i => i.names.international);
		if (!game) {
			return {
				success: false,
				reply: "Could not find a matching game for your query!"
			};
		}

		const categoryResponse = await core.Got.get("GenericAPI")({
			url: `https://www.speedrun.com/api/v1/games/${game.id}/categories`
		});

		let category;
		const categories = categoriesSchema.parse(categoryResponse.body).data;
		if (context.params.category) {
			category = selectClosestObject(context.params.category, categories, i => i.name);
		}
		else {
			category = categories.at(0);
		}

		if (!category) {
			return {
				success: false,
				reply: `No valid category found! Try one of these: ${categories.map(i => i.name).join(", ")}`
			};
		}

		const cacheKey = makeCacheKey(game.id, category.id);
		let run = await core.Cache.getByPrefix(cacheKey) as RunData | null;
		if (!run) {
			const runsResponse = await core.Got.get("GenericAPI")({
				url: `https://www.speedrun.com/api/v1/leaderboards/${game.id}/category/${category.id}`
			});

			run = runsSchema.parse(runsResponse.body).data.runs.at(0)?.run ?? null;
			await core.Cache.setByPrefix(cacheKey, run, {
				expiry: 36e5
			});
		}

		if (!run) {
			return {
				success: true,
				reply: `${game.names.international} (${category.name}) has no logged speedruns.`
			};
		}

		let runnerName;
		const runnerId = run.players.at(0)?.id;
		if (!runnerId) {
			runnerName = "(no player name)";
		}
		else {
			const runnersResponse = await core.Got.get("GenericAPI")({
				url: `https://www.speedrun.com/api/v1/users/${runnerId}`
			});

			runnerName = runnersSchema.parse(runnersResponse.body).data.names.international;
		}

		const link = run.videos?.links?.[0]?.uri ?? run.weblink;
		const date = (run.date)
			? new SupiDate(run.date).format("Y-m-d")
			: "(no date)";

		const time = core.Utils.formatTime(run.times.primary_t);
		return {
			success: true,
			reply: core.Utils.tag.trim `
				${game.names.international} speedrun by ${runnerName}: ${time}.
				Run happened on ${date}.
				Category: ${category.name}
				${link}
			`
		};
	}),
	Dynamic_Description: (prefix) => [
		`Searches <a href="//speedrun.com">speedrun.com</a> for the world record run of a given game.`,
		`You can also specify categories. If you don't, the "default" one will be used.`,
		"",

		`<code>${prefix}speedrun (game name)</code>`,
		`<code>${prefix}speedrun Half-Life</code>`,
		"Searches for the world record run of the game's default category.",
		"",

		`<code>${prefix}speedrun (game name) category:(category name)</code>`,
		`<code>${prefix}speedrun Half-Life category:WON</code>`,
		"Searches for the world record run the game, in the specific category."
	]
});
