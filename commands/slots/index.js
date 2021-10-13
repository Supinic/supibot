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
	Static_Data: (() => ({
		leaderboardKeywords: ["leader", "leaders", "leaderboard", "winners"],
		patterns: [
			{
				name: "nam",
				pattern: [
					"aniki",
					"black",
					"bridge",
					"bruceu",
					"champ",
					"cheat",
					"cock",
					"cringe",
					"cum",
					"dab",
					"doc",
					"emote",
					"forsen",
					"fuck",
					"gay",
					"incest",
					"is",
					"it",
					"like",
					"lol",
					"mods",
					"nam",
					"nammers",
					"nymn",
					"okay",
					"or",
					"pewds",
					"poggers",
					"racist",
					"redneck",
					"rip",
					"run",
					"say",
					"sing",
					"smile",
					"spammers",
					"sucking",
					"uganda",
					"van",
					"weebs",
					"weird",
					"wife",
					"will"
				],
				notes: "Used mainly in nymn's chat for random shit. Contains a selection of words."
			},
			{
				name: "gachi",
				emotesRequired: true,
				pattern: (context, data) => {
					const regex = /^[gG]achi/;
					return data.emotes.filter(i => regex.test(i.name)).map(i => i.name);
				},
				notes: "Selects all gachimuchi-related emotes."
			},
			{
				name: "blob",
				pattern: [
					"a",
					"about",
					"anyway",
					"away",
					"bad",
					"be",
					"blob",
					"breakfast",
					"cook",
					"cow",
					"do",
					"dont",
					"ever",
					"for",
					"fuckin",
					"fucking",
					"get",
					"hire",
					"in",
					"it",
					"its",
					"job",
					"lazy",
					"like",
					"me",
					"mind",
					"mothers",
					"my",
					"need",
					"no",
					"one",
					"quick",
					"right",
					"school",
					"smart",
					"thats",
					"their",
					"to",
					"too",
					"up",
					"what",
					"wheres",
					"while",
					"with",
					"would",
					"you",
					"your"
				],
				notes: "Contains quotes related to Anthony \"Obama Chavez\" Stone. pajaWTH"
			},
			{
				name: "twitch",
				emotesRequired: true,
				pattern: (context, data) => data.emotes.filter(i => i.type === "twitch-global").map(i => i.name),
				notes: "All Twitch global emotes."
			},
			{
				name: "sub",
				emotesRequired: true,
				pattern: (context, data) => data.emotes.filter(i => i.type === "twitch-subscriber").map(i => i.name),
				notes: "Rolls random emotes from Supibot's current subscriber emote list."
			},
			{
				name: "bttv",
				emotesRequired: true,
				pattern: (context, data) => data.emotes.filter(i => i.type === "bttv").map(i => i.name),
				notes: "Rolls from BTTV emotes in the current channel."
			},
			{
				name: "ffz",
				emotesRequired: true,
				pattern: (context, data) => data.emotes.filter(i => i.type === "ffz").map(i => i.name),
				notes: "Rolls from FFZ emotes in the current channel."
			},
			{
				name: "pepe",
				emotesRequired: true,
				pattern: (context, data) => data.emotes.filter(i => i.name.toLowerCase().startsWith("pepe")).map(i => i.name),
				notes: "Rolls from all Pepe-related emotes in the current channel."
			},
			{
				name: "lotto",
				pattern: () => ({
					emotes: new Array(69).fill(0).map((i, ind) => String(ind)),
					limit: 5
				}),
				notes: "Rolls something akin to a Lotto lottery - 5 numbers, 1 to 69 each."
			},
			{
				name: "numbers",
				pattern: (context, data) => {
					const target = Number(data.args[0]);
					if (!sb.Utils.isValidInteger(target)) {
						return {
							success: false,
							reply: "You must provide a proper number to roll the number slots!"
						};
					}
					else if (target > Number.MAX_SAFE_INTEGER) {
						return {
							success: false,
							reply: `The number must be an integer in the <2..${Number.MAX_SAFE_INTEGER}> range!`
						};
					}

					return {
						roll: () => sb.Utils.random(1, target),
						uniqueItems: target
					};
				},
				notes: "Rolls 3 numbers, from 1 to the given maximum. Must not exceed the maximum integer value, which is 9007199254740991."
			},
			{
				name: "jebaited",
				pattern: [
					"You", "lost", "lol"
				],
				notes: "Jebaited"
			}
		]
	})),
	Code: (async function slots (context, ...args) {
		if (this.staticData.leaderboardKeywords.includes(args[0])) {
			return {
				reply: "Check out all the previous slots winners here: https://supinic.com/data/slots-winner/list",
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

		let emotes = [...args];
		const preset = this.staticData.patterns.find(i => i.name === patternName);
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
	Dynamic_Description: (async (prefix, values) => {
		const { leaderboardKeywords, patterns } = values.getStaticData();
		const patternList = patterns
			.sort((a, b) => a.name.localeCompare(b.name))
			.map(i => `<li><code>${i.name}</code><br>${i.notes}</li>`)
			.join("");

		return [
			"Rolls three random words out of the given list of words. If you get a flush, you win!",
			`Every winner is listed in <a href="https://supinic.com/data/slots-winner/list">this neat table</a>.`,
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
			`You can also check it out here: <a href="/data/slots-winner/list">Slots winners list</a>`
		];
	})
};
