module.exports = {
	Name: "slots",
	Aliases: null,
	Author: "supinic",
	Cooldown: 20000,
	Description: "Once at least three unique emotes (or words) have been provided, rolls a pseudo slot machine to see if you get a flush.",
	Flags: ["mention","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (() => ({
		patterns: [
			{
				name: "#nam",
				pattern: [
					"aniki", "black", "bridge", "bruceu", "champ", "cheat", "cock", "cringe", "cum", "dab",
					"doc", "emote", "forsen", "fuck", "gay", "incest", "is", "it", "like", "lol",
					"mods", "nam", "nammers", "nymn", "okay", "or", "pewds", "poggers", "racist", "redneck",
					"rip", "run", "say", "sing", "smile", "spammers", "sucking", "uganda", "van", "weebs",
					"weird", "wife", "will"
				],
				notes: "Used mainly in nymn's chat for random shit. Contains a selection of words."
			},
			{
				name: "#gachi",
				pattern: [
					"gachiCOOL", "gachiJAM", "gachiHop", "gachiANGEL", "gachiBOP",
					"gachiBASS", "gachiHYPER", "GachiPls", "gachiVICTORY", "gachiOnFIRE",
					"gachiGold", "gachiPRIDE"
				],
				notes: "Contains most gachi emotes. Based on pajlada's selection in his channel."
			},
			{
				name: "#blob",
				pattern: [
					"a", "about", "anyway", "away", "bad", "be", "blob", "breakfast", "cook", "cow",
					"do", "dont", "ever", "for", "fuckin", "fucking", "get", "hire", "in", "it",
					"its", "job", "lazy", "like", "me", "mind", "mothers", "my", "need",
					"no", "one", "quick", "right", "school", "smart", "thats", "their", "to",
					"too", "up", "what", "wheres", "while", "with", "would", "you", "your"
				],
				notes: "Contains quotes related to Anthony \"Obama Chavez\" Stone. pajaWTH"
			},
			{
				name: "#twitch",
				pattern: () => {
					const { controller } = sb.Platform.get("twitch");
					if ((controller?.availableEmotes ?? []).length === 0) {
						return "Twitch messed up, no emotes available...";
					}
	
					return controller.availableEmotes
						.filter(emoteSet => emoteSet.tier === null)
						.flatMap(emoteSet => emoteSet.emotes.map(emote => emote.token));
				},
				notes: "All Twitch global emotes."
			},
			{
				name: "#sub",
				pattern: () => {
					const { controller } = sb.Platform.get("twitch");
					if ((controller?.availableEmotes ?? []).length === 0) {
						return "Twitch messed up, no emotes available...";
					}
	
					return controller.availableEmotes
						.filter(emoteSet => ["1", "2", "3"].includes(emoteSet.tier))
						.flatMap(emoteSet => emoteSet.emotes.map(emote => emote.token));
				},
				notes: "Rolls random emotes from supibot's current subscriber emote list."
			},
			{
				name: "#bttv",
				pattern: (async function slotsPattern_bttv (context) {
					const data = await sb.Got({
						throwHttpErrors: false,
						url: "https://api.betterttv.net/2/channels/" + context.channel.Name
					}).json();
	
					if (data.status === 404 || !data.emotes || data.emotes.length === 0) {
						return "Well, yeah, but BTTV is like a 3rd party thing, and I don't know...";
					}
	
					return data.emotes.map(i => i.code);
				}),
				notes: "Rolls from BTTV emotes in the current channel."
			},
			{
				name: "#ffz",
				pattern: (async function slotsPattern_ffz (context) {
					const { statusCode, body: data } = await sb.Got({
						responseType: "json",
						throwHttpErrors: false,
						url: "https://api.frankerfacez.com/v1/room/" + context.channel.Name
					});
	
					if (statusCode === 404) {
						return { reply: "This channel doesn't exist within FFZ database!" };
					}
					else if (!data.sets) {
						return { reply: "No FFZ emotes found!" };
					}
	
					const set = Object.keys(data.sets)[0];
					if (data.sets[set].emoticons.length === 0) {
						return { reply: "This channel has no FFZ emotes enabled." };
					}
	
					return data.sets[set].emoticons.map(i => i.name);
				}),
				notes: "Rolls from FFZ emotes in the current channel."
			},
			{
				name: "#pepe",
				pattern: (async function slotsPattern_pepe (context) {
					const fullEmotesList = (await Promise.all([
						(async () => {
							const raw = await sb.Got("https://api.betterttv.net/2/channels/" + context.channel.Name).json();
							if (raw.status === 404 || raw.emotes.length === 0) {
								return [];
							}
	
							return raw.emotes.map(i => i.code);
						})(),
						(async () => {
							const raw = await sb.Got("https://api.frankerfacez.com/v1/room/" + context.channel.Name).json();
							const set = Object.keys(raw.sets)[0];
							if (raw.sets[set].emoticons.length === 0) {
								return [];
							}
	
							return raw.sets[set].emoticons.map(i => i.name);
						})()
					])).flat();
	
					const filtered = fullEmotesList.filter(i => i.toLowerCase().includes("pepe"));
					return (filtered.length >= 3)
						? filtered
						: "Not enough pepe- emotes are active in this channel supiniL";
				}),
				notes: "Rolls from all emotes in the current channel that contain the string \"pepe"
			},
			{
				name: "#lotto",
				pattern: () => ({
					emotes: Array(69).fill(0).map((i, ind) => String(ind)),
					limit: 5
				}),
				notes: "Rolls something akin to a Lotto lottery - 5 numbers, 1 to 69 each."
			},
			{
				name: "#numbers",
				pattern: (extra, type, number) => {
					const target = Number(number);
					if (!target || target > Number.MAX_SAFE_INTEGER || target < 1 || Math.trunc(target) !== target) {
						return "The number must be an integer between 2 and " + Number.MAX_SAFE_INTEGER;
					}
	
					return {
						roll: () => sb.Utils.random(1, target),
						uniqueItems: target
					};
				},
				notes: "Rolls 3 numbers, from 1 to the given maximum. Must not exceed the maximum integer value, which is 9007199254740991."
			},
			{
				name: "#jebaited",
				pattern: [
					"You", "lost", "lol"
				], "Type": "Array", notes: "Jebaited"
			}
		]
	})),
	Code: (async function slots (context, ...emotes) {
		if (emotes[0] === "leader" || emotes[0] === "leaders") {
			return {
				reply: "Check out all the previous slots winners here! https://supinic.com/bot/slots-winner/list",
				cooldown: 5000
			};
		}
	
		const check = this.staticData.patterns.find(i => i.name === emotes[0]);
		let limit = 3;
		let type = "array";
		let uniqueItems = null;
		const rolledItems = [];
	
		if (check) {
			if (Array.isArray(check.pattern)) {
				emotes = check.pattern;
			}
			else if (typeof check.pattern === "function") {
				const result = await check.pattern(context, ...emotes);
	
				if (typeof result === "string") {
					// This basically means something went wrong somehow (like no emotes found in that channel)
					// Reply with that response instead of rolling for emotes.
					return {
						success: false,
						reply: result
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
	
		if (type === "array") {
			if (emotes.length < limit) {
				return {
					reply: "You must provide at least " + limit + " emotes/words to roll the slots!",
					cooldown: this.Cooldown / 2
				};
			}
	
			for (let i = 0; i < limit; i++) {
				rolledItems.push(sb.Utils.randArray(emotes));
			}
	
			uniqueItems = emotes.filter((i, ind, arr) => arr.indexOf(i) === ind).length;
		}
	
		if (rolledItems.every(i => rolledItems[0] === i)) {
			if (uniqueItems === 1) {
				return {
					reply: `[ ${rolledItems.join(" ")} ] -- FeelsDankMan You won and beat the odds of 100%.`
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
				Source: (Array.isArray(emotes)) ? emotes.join(" ") : ("Number roll: 1 to " + uniqueItems),
				Result: rolledItems.join(" "),
				Channel: context.channel?.ID ?? null,
				Odds: reverseChance
			});
	
			await row.save();
			return {
				reply: `[ ${rolledItems.join(" ")} ] -- PagChomp A flush! Congratulations, you beat the odds of ${sb.Utils.round(chance * 100, 3)}% (that is 1 in ${reverseChance})`
			};
		}
	
		return {
			reply: `[ ${rolledItems.join(" ")} ]`
		};
	}),
	Dynamic_Description: (async (prefix, values) => {
		const { patterns } = values.getStaticData();
		const patternList = patterns
			.sort((a, b) => a.name.localeCompare(b.name))
			.map(i => `<li><code>${i.name}</code><br>${i.notes}</li>`)
			.join("");
	
		return [
			"Rolls three random words out of the given list of words. If you get a flush, you win!",
			`Every winner is listed in <a href="https://supinic.com/bot/slots-winner/list">this neat table</a>.`,
			"",
	
			`<code>${prefix}slots (list of words)</code>`,
			"Three rolls will be chose randomly. Get the same one three times for a win.",
			"",
	
			`<code>${prefix}slots #(pattern)</code>`,
			"Uses a pre-determined or dynamic pattern as your list of words.",
			"",
	
			"Supported patterns:",
			`<ul>${patternList}</ul>`
		];
	})
};