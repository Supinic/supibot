const subcommands = require("./subcommands");
const SUBCOMMAND_NAMES = subcommands.map(i => i.name).join(", ");

module.exports = {
	Name: "formula1",
	Aliases: ["f1"],
	Author: "supinic",
	Cooldown: 7500,
	Description: "Aggregate command about anything regarding Formula 1.",
	Flags: ["mention","pipe"],
	Params: [
		{ name: "season", type: "number" },
		{ name: "year", type: "number" },
		{ name: "weather", type: "boolean" }
	],
	Whitelist_Response: null,
	Code: (async function formula1 (context, ...args) {
		const type = (args[0] ?? "race").toLowerCase();
		const subcommand = subcommands.find(i => i.name === type || i.aliases?.includes(type));
		if (!subcommand) {
			return {
				success: false,
				reply: `Invalid subcommand provided! Use one of ${SUBCOMMAND_NAMES}`
			};
		}

		const rest = args.slice(1);
		return await subcommand.execute(context, type, ...rest);
	}),
	Dynamic_Description: (async (prefix) => {
		const subcommandDescriptions = subcommands.map(cmd => {
			return [`<h6>${cmd.name}</h6>`, ...cmd.description].join("\n");
		}).join("\n\n");

		return [
			"All things F1-related in a single command.",
			`Powered by <a href="https://ergast.com/mrd/">Ergast Developer API</a>`,
			`If you have any suggestions, addition ideas or anything else, make sure to let me know via the <a href="https://supinic.com/bot/command/detail/suggest">$suggest</a> command!`,
			"",

			`<code>${prefix}f1</code>`,
			"Posts quick info about the upcoming race - in the current season.",
			"",

			...subcommandDescriptions
		];
	})
};
