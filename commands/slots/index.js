module.exports = {
	Name: "slots",
	Aliases: null,
	Author: "supinic",
	Cooldown: 20000,
	Description: "Once at least three unique emotes (or words) have been provided, rolls a pseudo slot machine to see if you get a flush.",
	Flags: ["mention","pipe","use-params"],
	Params: [
		{ name: "pattern", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function slots (context, ...args) {
		const { leaderboardKeywords, patterns } = require("./definitions.js");

		if (leaderboardKeywords.includes(args[0])) {
			return {
				reply: "Check out all the previous slots winners here: https://supinic.com/data/slots-winner/leaderboard",
				cooldown: 5000
			};
		}

		if (!context.channel) {
			return {
				success: false,
				reply: `This command cannot be used in private messages!`
			};
		}

		let limit = 3;
		let type = "array";
		let uniqueItems = null;
		const rolledItems = [];

		let deprecationWarning = "";
		let patternName = context.params.pattern ?? null;
		if (args[0] && args[0].startsWith("#")) {
			patternName = args[0].slice(1);
			deprecationWarning = `Patterns with # are deprecated, use pattern:${patternName} instead.`;
			args.splice(0, 1);
		}

		let emotes = args.join(" ").split(/\s+/).filter(Boolean);
		const preset = patterns.find(i => i.name === patternName);
		if (preset) {
			if (Array.isArray(preset.pattern)) {
				emotes = preset.pattern;
			}
			else if (typeof preset.pattern === "function") {
				const presetData = { args };
				if (preset.emotesRequired) {
					presetData.emotes = await context.channel.fetchEmotes();
				}

				const result = await preset.pattern(context, presetData);
				if (result.success === false) {
					return {
						...result,
						cooldown: result.cooldown ?? 2500
					};
				}
				else if (Array.isArray(result)) {
					emotes = result;
				}
				else if (result.constructor === Object) {
					if (typeof result.roll === "function") {
						limit = result.limit || limit;
						uniqueItems = result.uniqueItems;
						type = "function";

						for (let i = 0; i < limit; i++) {
							rolledItems.push(result.roll());
						}
					}
					else if (Array.isArray(result.emotes)) {
						emotes = result.emotes;
						limit = result.limit || limit;
					}
				}
			}
		}
		else if (context.params.pattern) { // pattern provided as a param, but no match found - error
			return {
				success: false,
				reply: `Provided slots preset does not exist!`
			};
		}

		if (type === "array") {
			if (emotes === null || emotes.length < limit) {
				return {
					reply: `You must provide at least ${limit} emotes/words to roll the slots!`,
					cooldown: 2500
				};
			}

			for (let i = 0; i < limit; i++) {
				rolledItems.push(sb.Utils.randArray(emotes));
			}

			uniqueItems = emotes.filter((i, ind, arr) => arr.indexOf(i) === ind).length;
		}

		if (rolledItems.every(i => rolledItems[0] === i)) {
			if (uniqueItems === 1) {
				const dankEmote = await context.getBestAvailableEmote(["FeelsDankMan", "FeelsDonkMan"], "🤡");
				return {
					reply: sb.Utils.tag.trim `
						[ ${rolledItems.join(" ")} ] 
						${dankEmote} 
						You won and beat the odds of 100%.
						${deprecationWarning}
					`
				};
			}

			let chance = null;
			if (type === "array") {
				const winningItems = emotes.filter(i => i === rolledItems[0]);
				chance = (winningItems.length === 1)
					? (winningItems.length / emotes.length) ** (limit - 1)
					: (winningItems.length / emotes.length) ** (limit);
			}
			else if (type === "function") {
				chance = (1 / uniqueItems) ** (limit - 1);
			}

			const reverseChance = sb.Utils.round((1 / chance), 3);
			const row = await sb.Query.getRow("data", "Slots_Winner");
			row.setValues({
				User_Alias: context.user.ID,
				Source: (Array.isArray(emotes)) ? emotes.join(" ") : (`Number roll: 1 to ${uniqueItems}`),
				Result: rolledItems.join(" "),
				Channel: context.channel?.ID ?? null,
				Odds: reverseChance
			});

			// Discard the row save result - not needed anywhere
			const [, pogEmote] = await Promise.all([
				row.save(),
				context.getBestAvailableEmote(["PagChomp", "Pog", "PogChamp"], "🎉")
			]);

			return {
				reply: sb.Utils.tag.trim `
					[ ${rolledItems.join(" ")} ] 
					${pogEmote} A flush! 
					Congratulations, you beat the odds of
					${sb.Utils.round(chance * 100, 3)}%
					(that is 1 in ${reverseChance})
					${deprecationWarning}
				`
			};
		}

		return {
			reply: `[ ${rolledItems.join(" ")} ] ${deprecationWarning}`
		};
	}),
	Dynamic_Description: (async (prefix) => {
		const { leaderboardKeywords, patterns } = require("./definitions.js");
		const patternList = [...patterns]
			.sort((a, b) => a.name.localeCompare(b.name))
			.map(i => `<li><code>${i.name}</code><br>${i.notes}</li>`)
			.join("");

		return [
			"Rolls three random words out of the given list of words. If you get a flush, you win!",
			`Every winner is listed in <a href="https://supinic.com/data/slots-winner/leaderboard">this neat table</a>.`,
			"",

			`<code>${prefix}slots (list of words)</code>`,
			"Three rolls will be chose randomly. Get the same one three times for a win.",
			"",

			`<code>${prefix}slots pattern:(pattern name)</code>`,
			"Uses a pre-determined or dynamic pattern as your list of words. See below.",
			"",

			"Supported patterns:",
			`<ul>${patternList}</ul>`,

			...leaderboardKeywords.map(i => `<code>${prefix}slots ${i}</code>`),
			"Posts a link to the slots winners leaderboard, sorted by the odds of winning.",
			`You can also check it out here: <a href="/data/slots-winner/leaderboard">Slots winners list</a>`
		];
	})
};
