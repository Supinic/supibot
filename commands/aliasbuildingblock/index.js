module.exports = {
	Name: "aliasbuildingblock",
	Aliases: ["abb"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "A collection of smaller commands, only usable within aliases - and not as standalone commands. Consider these \"building blocks\" for more complex aliases, without needing to make them yourself.",
	Flags: ["external-input","pipe","skip-banphrase"],
	Params: [
		{ name: "amount", type: "number" },
		{ name: "em", type: "string" },
		{ name: "errorMessage", type: "string" },
		{ name: "excludeSelf", type: "boolean" },
		{ name: "regex", type: "regex" },
		{ name: "replacement", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: ((commandData) => ({
		blocks: [
			{
				name: "argumentsCheck",
				aliases: ["ac", "argCheck"],
				description: "Takes a number range - expected amount of arguments as first argument. If the amount of actual arguments falls in the range, simply returns output; if not, returns an error. You can specify a custom error message with the parameter em/errorMessage, where your underscores will be replaced by spaces.",
				examples: [
					["$abb argCheck 3 a b c", "a b c"],
					["$abb ac 1..5 a b c", "a b c"],
					["$abb ac ..2 a b c", "Error! ..2 arguments expected, got 3"],
					["$abb ac 5.. a", "Error! 5.. arguments expected, got 1"],
					["$abb ac 2 foo", "Error! Expected 2 arguments, got 1"],
					["$abb ac errorMessage:\"No I don't think so\" 2 foo", "Error! No I don't think so"]
				],
				execute: (context, limit, ...args) => {
					if (!limit) {
						return {
							success: false,
							reply: `No argument limit provided!`
						};
					}

					const range = limit.split("..").map(i => i === "" ? null : Number(i));
					if (range.length === 0) { // ".." - interpreted as "any"
						return {
							reply: args.join(" ")
						};
					}
					else if (range.some(i => i !== null && !sb.Utils.isValidInteger(i))) {
						return {
							success: false,
							reply: `Invalid arguments range provided`
						};
					}

					range[0] = range[0] ?? 0;
					if (range[1] === null) {
						range[1] = Infinity;
					}
					else if (typeof range[1] === "undefined") {
						range[1] = range[0];
					}

					if (range[0] > range[1]) {
						return {
							success: false,
							reply: `Lower argument range bound must not be greater than the upper one!`
						};
					}
					else if (range[0] <= args.length && args.length <= range[1]) {
						return {
							reply: args.join(" ")
						};
					}
					else {
						const reply = (
							context.params.em
							?? context.params.errorMessage
							?? `Expected ${limit} arguments, got ${args.length} instead!`
						);

						return {
							success: false,
							reply,
							forceExternalPrefix: true
						};
					}
				}
			},
			{
				name: "bestavailableemote",
				aliases: ["bae"],
				description: "For a list of emotes, uses the first one that is actually available in the channel. The last one should be a \"fallback\", so it should be available anywhere.",
				examples: [
					["channel with just LULW: $abb bae PepeLaugh pepeLaugh LULW LULE 4Head", "LULW"],
					["channel with no emotes: $abb bae PepeLaugh pepeLaugh LULW LULE 4Head", "4Head"]
				],
				execute: async (context, ...args) => {
					if (args.length < 2) {
						return {
							success: false,
							reply: `At least two emotes must be provided - one to check, one to fall back on!`
						};
					}

					const bestMatch = await context.getBestAvailableEmote(args.slice(0, -1), args[args.length - 1]);
					return {
						reply: bestMatch
					};
				}
			},
			{
				name: "channel",
				aliases: [],
				description: "Prints the current channel, or \"(none\") if in PMs.",
				examples: [
					["$abb channel", "(current channel)"]
				],
				execute: (context) => ({
					reply: context.channel?.Name ?? "(none)"
				})
			},
			{
				name: "chatter",
				aliases: [],
				description: "Selects a random chatter within the channel, and outputs their name. Not applicable in PMs. Use the \"excludeSelf:true\" parameter to exclude yourself from the random chatter roll",
				examples: [
					["$abb chatter", "(user))"],
					["$abb chatter excludeSelf:true", "(someone who is not you)"]
				],
				execute: async (context) => {
					if (context.privateMessage) {
						return {
							success: false,
							reply: "There is nobody else here 😨"
						};
					}
					else if (typeof context.channel.fetchUserList !== "function") {
						return {
							success: false,
							reply: "This has not been implemented here... yet! 4Head"
						};
					}

					const onCooldown = !sb.CooldownManager.check(context.channel.ID, context.user.ID, "abb-chatter", true);
					if (onCooldown) {
						return {
							success: false,
							reply: "Currently on cooldown!"
						};
					}

					const users = await context.channel.fetchUserList();
					const botIndex = users.findIndex(i => i.toLowerCase() === context.platform.Self_Name);
					if (botIndex !== -1) {
						users.splice(botIndex, 1);
					}

					if (context.params.excludeSelf) {
						const index = users.findIndex(i => i.toLowerCase() === context.user.Name);
						if (index !== -1) {
							users.splice(index, 1);
						}
					}

					sb.CooldownManager.set(context.channel.ID, context.user.ID, "abb-chatter", commandData.Cooldown);
					return {
						reply: sb.Utils.randArray(users)
					};
				}
			},
			{
				name: "executor",
				aliases: ["self"],
				description: "Prints your username.",
				examples: [
					["$abb executor", "(you)"]
				],
				execute: (context) => ({
					reply: context.user.Name
				})
			},
			{
				name: "explode",
				aliases: [],
				description: "Adds a space between all characters of the provided input - then, each one can be used as a specific argument.",
				examples: [
					["$abb explode this is a test", "t h i s i s a t e s t"]
				],
				execute: (context, ...args) => ({
					reply: Array.from(args.join(" "))
						.join(" ")
						.replace(/\s+/g, " ")
				})
			},
			{
				name: "platform",
				aliases: [],
				description: "Prints the name of the current platform.",
				examples: [
					["$abb platform", "twitch"]
				],
				execute: (context) => ({
					reply: context.platform.Name
				})
			},
			{
				name: "repeat",
				aliases: [],
				description: "For the provided word or words, they will be repeated up to provided amount of times",
				examples: [
					["$abb repeat amount:5 hello", "hello hello hello hello hello"],
					["$abb repeat amount:3 hello world everyone", "hello world everyone hello world everyone hello world everyone"]
				],
				execute: (context, ...args) => {
					const { amount } = context.params;
					if (typeof amount !== "number") {
						return {
							success: false,
							reply: `No repeat amount provided!`
						};
					}
					else if (!sb.Utils.isValidInteger(amount)) {
						return {
							success: false,
							reply: `The provided amount must be a positive integer!`
						};
					}

					const query = args.join(" ");
					if (!query) {
						return {
							success: false,
							reply: `You must provide something to repeat!`
						};
					}

					const limit = context.channel?.Message_Limit ?? context.platform.Message_Limit;
					const maximumRepeats = Math.trunc(limit / query.length);
					const actualRepeats = Math.min(amount, maximumRepeats);

					return {
						reply: query.repeat(actualRepeats)
					};
				}
			},
			{
				name: "replace",
				aliases: [],
				description: "Takes two params: regex, replacement. For the given regex, replaces all matches with the provided value.",
				examples: [
					["$abb replace regex:/a+b/ replacement:lol aaaaaabbb", "lolbb"],
					["$abb replace regex:/foo/ replacement:NaM Damn foo spam", "Damn NaM spam"]
				],
				execute: (context, ...args) => {
					if (!context.params.regex || typeof context.params.replacement !== "string") {
						return {
							success: false,
							reply: `Missing parameter(s)! regex, replacement`
						};
					}

					return {
						reply: args.join(" ").replace(context.params.regex, context.params.replacement)
					};
				}
			},
			{
				name: "say",
				aliases: ["echo"],
				description: "Simply outputs the input, with no changes.",
				examples: [
					["$abb say hello", "hello"]
				],
				execute: (context, ...args) => ({
					reply: args.join(" ")
				})
			},
			{
				name: "tee",
				aliases: [],
				description: "Saves the output of the previous command into memory, which can be accessed later. The output is also passed on.",
				examples: [
					["$pipe rl | abb tee", "(random line)"]
				],
				execute: (context, ...args) => {
					const input = args.join(" ");
					if (!input) {
						return {
							success: false,
							reply: `No input provided!`
						};
					}

					context.tee.push(input);

					return {
						reply: input
					};
				}
			}
		]
	})),
	Code: (async function aliasBuildingBlock (context, type, ...args) {
		const { blocks } = this.staticData;
		if (!context.append.alias && !context.append.pipe) {
			if (!type) {
				return {
					success: false,
					reply: `This command can only be used within aliases or pipes! Check help here: ${this.getDetailURL()}`
				};
			}

			type = type.toLowerCase();
			const block = blocks.find(i => i.name === type || i.aliases.includes(type));
			if (!block) {
				return {
					success: false,
					reply: `This command can only be used within aliases or pipes! Check help here: ${this.getDetailURL()}`
				};
			}
			else {
				return {
					success: false,
					reply: `This command can only be used within aliases or pipes! Block description: ${block.description}`
				};
			}
		}

		if (!type) {
			return {
				success: false,
				reply: `No block type provided! Check help here: ${this.getDetailURL()}`
			};
		}

		type = type.toLowerCase();
		const block = blocks.find(i => i.name === type || i.aliases.includes(type));
		if (!block) {
			return {
				success: false,
				reply: `Incorrect block type provided! Check help here: ${this.getDetailURL()}`
			};
		}

		const result = await block.execute(context, ...args);
		return {
			cooldown: result.cooldown ?? null,
			...result
		};
	}),
	Dynamic_Description: (async function (prefix) {
		const { blocks } = this.staticData;
		const list = blocks.map(i => {
			const aliases = (i.aliases.length > 0)
				? `(${i.aliases.join(", ")})`
				: "";

			const examples = (i.examples.length > 0)
				? `<br><ul>${i.examples.map(j => `<li><code>${j[0]}</code> ➡ <code>${j[1]}</code></li>`).join("")}</ul>`
				: "";

			return `<li><code>${i.name}${aliases}</code><br>${i.description}${examples}</li>`;
		});

		return [
			"This is a collection of smaller, simpler commands that are only usable within user-made aliases.",
			"These serve as a simplification of commonly used aliases, to make your life easier when making new aliases.",
			"",

			`<code>${prefix}abb (type)</code>`,
			`<code>${prefix}aliasbuildingblock (type)</code>`,
			"For a given block type, executes a small command to be used in the alias.",

			"Blocks:",
			`<ul>${list.join("")}</ul>`
		];
	})
};
