module.exports = {
	Name: "speedrun",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches the current world record speedrun of a given name in the default category. Check extended help for more info.",
	Flags: ["mention","non-nullable","pipe","use-params"],
	Params: [
		{ name: "category", type: "string" },
		{ name: "showCategories", type: "boolean" },
		{ name: "abbreviation", type: "string" },
		{ name: "abbr", type: "string" },
		{ name: "runner", type: "string" },
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function speedrun (context, ...args) {
		const showCategories = (context.params.showCategories === true);
		const categoryName = context.params.categoryName ?? null;

		const searchParams = {};
		if (args.length > 0) {
			searchParams.name = args.join(" ");
		}
		else if (context.params.abbreviation || context.params.abbr) {
			searchParams.abbreviation = context.params.abbreviation ?? context.params.abbr;
		}

		if (Object.keys(searchParams).length === 0) {
			return {
				success: false,
				reply: "You did not provide anything to search for a game! Use abbreviation or the full game name."
			};
		}

		const { data: gameData } = await sb.Got("Speedrun", {
			url: "games",
			searchParams
		}).json();

		if (gameData.length === 0) {
			return {
				success: false,
				reply: `No such game found!`
			};
		}

		const [game] = gameData;
		const { data: categoryData } = await sb.Got("Speedrun", `games/${game.id}/categories`).json();
		if (showCategories) {
			return {
				reply: `Available categories for ${game.names.international}: ${categoryData.map(i => i.name).join(", ")}.`
			};
		}

		let category;
		if (categoryName === null) {
			category = categoryData[0];
		}
		else {
			const categories = categoryData.map(i => i.name);
			const categoryMatch = sb.Utils.selectClosestString(categoryName, categories, { descriptor: true });

			category = (categoryMatch) ? categoryData[categoryMatch.index] : null;
		}

		if (!category) {
			return {
				success: false,
				reply: `No such category found! Try one of thise: ${categoryData.map(i => i.name).join(", ")}`
			};
		}

		const filtersData = await sb.Got("Speedrun", {
			url: `categories/${category.id}/variables`
		}).json();
		const defaultFilters = Object.fromEntries(
			Object.values(filtersData.data).map(filter => {
				if (filter.values.default) {
					return [filter.id, filter.values.default];
				}
			}).filter(Boolean)
		);

		let runsData;
		const cacheKey = { category: category.id, game: game.id };
		const cachedRunsData = await this.getCacheData(cacheKey);
		if (cachedRunsData) {
			runsData = cachedRunsData;
		}
		else {
			const freshRunsData = await sb.Got("Speedrun", {
				url: `leaderboards/${game.id}/category/${category.id}`
			}).json();

			runsData = freshRunsData.data;
			await this.setCacheData(cacheKey, runsData, {
				expiry: 36e5
			});
		}

		if (runsData.runs.length === 0) {
			return {
				reply: `${game.names.international} (${category.name}) has no runs.`
			};
		}

		let runner;
		if (context.params.runner) {
			const runnerData = await sb.Got("Speedrun", {
				url: "users",
				searchParams: {
					lookup: context.params.runner
				}
			}).json();

			if (runnerData.data.length === 0) {
				return {
					success: false,
					reply: `No such runner found!`
				};
			}

			runner = runnerData.data[0];
		}

		const filteredRuns = runsData.runs.map(i => i.run).filter(runData => {
			for (const [key, value] of Object.entries(defaultFilters)) {
				if (runData.values[key] !== value) {
					return false;
				}
			}

			return true;
		});

		const runnerRuns = filteredRuns.filter(runData => {
			if (runner) {
				if (!runData.players) {
					return false;
				}

				const runnerFound = runData.players.find(i => i.id === runner.id);
				if (!runnerFound) {
					return false;
				}
			}

			return true;
		})

		if (runnerRuns.length === 0) {
			return {
				success: false,
				reply: `No matching speedruns found!`
			};
		}
		
		const [run] = runnerRuns;
		if (!runner) {
			const { statusCode, body: runnerData } = await sb.Got("Speedrun", {
				url: `users/${run.players[0].id}`,
				throwHttpErrors: false
			});

			if (statusCode === 404) {
				return {
					success: false,
					reply: "Runner not found!"
				};
			}

			runner = runnerData.data;
		}

		const link = run.videos?.links?.[0]?.uri ?? run.weblink;
		const date = new sb.Date(run.date).format("Y-m-d");
		const time = sb.Utils.formatTime(run.times.primary_t);
		return {
			reply: sb.Utils.tag.trim `
				Speedrun by ${runner.names.international}: ${time}.
				Executed: ${date}.
				Category: ${game.names.international} (${category.name})
				${link}
			`
		};
	}),
	Dynamic_Description: (async (prefix) => {
		return [
			`Searches <a href="//speedrun.com">speedrun.com</a> for the world record run of a given game.`,
			`You can also specify categories. If you don't, the "default" one will be used.`,
			"",

			`<code>${prefix}speedrun Doom II</code>`,
			"Searches for the world record run of Doom II's default category (Hell on Earth).",
			"",

			`<code>${prefix}speedrun Doom II category:UV</code>`,
			"Searches for the world record run of Doom II's UV Speed category.",
			"",

			`<code>${prefix}speedrun Doom II showCategories:true</code>`,
			"Posts a list of all tracked categories for Doom II.",
			"",

			`<code>${prefix}speedrun Larry Love for Sail runner:supinic</code>`,
			"Posts the best attempt of a given speedrunner for a given game.",
			"",

			`<code>${prefix}speedrun abbr:mc</code>`,
			`<code>${prefix}speedrun abbreviation:mc</code>`,
			"Searches for the world record run of Minecraft: Java Edition.",
			`The abbreviation is the tag "mc" - as seen on the site: <a href="https://www.speedrun.com/mc">speedrun.com/mc</a>`
		];
	})
};
