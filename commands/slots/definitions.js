module.exports = {
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
				return data.emotes
					.filter(i => regex.test(i.name))
					.map(i => i.name);
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
			pattern: (context, data) => data.emotes
				.filter(i => i.type === "twitch-global")
				.map(i => i.name),
			notes: "All Twitch global emotes."
		},
		{
			name: "sub",
			emotesRequired: true,
			pattern: (context, data) => data.emotes
				.filter(i => i.type === "twitch-subscriber")
				.map(i => i.name),
			notes: "Rolls random emotes from Supibot's current subscriber emote list."
		},
		{
			name: "bttv",
			emotesRequired: true,
			pattern: (context, data) => data.emotes
				.filter(i => i.type === "bttv")
				.map(i => i.name),
			notes: "Rolls from BTTV emotes in the current channel."
		},
		{
			name: "ffz",
			emotesRequired: true,
			pattern: (context, data) => data.emotes
				.filter(i => i.type === "ffz")
				.map(i => i.name),
			notes: "Rolls from FFZ emotes in the current channel."
		},
		{
			name: "7tv",
			emotesRequired: true,
			pattern: (context, data) => data.emotes
				.filter(i => i.type === "7tv")
				.map(i => i.name),
			notes: "Rolls from 7TV emotes in the current channel."
		},
		{
			name: "pepe",
			emotesRequired: true,
			pattern: (context, data) => data.emotes
				.filter(i => i.name.toLowerCase().startsWith("pepe"))
				.map(i => i.name),
			notes: "Rolls from all Pepe-related emotes in the current channel."
		},
		{
			name: "lotto",
			pattern: () => ({
				emotes: new Array(69)
					.fill(0)
					.map((i, ind) => String(ind)),
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
};
