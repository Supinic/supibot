import { declare, type SubcommandDefinition } from "../../classes/command.js";
import { FormulaOneSubcommands } from "./subcommands/index.js";

export type FormulaOneSubcommandDefinition = SubcommandDefinition<typeof formulaOneCommandDefinition>;

const formulaOneCommandDefinition = declare({
	Name: "formula1",
	Aliases: ["f1"],
	Cooldown: 5000,
	Description: "Aggregate command about anything regarding Formula 1.",
	Flags: ["mention","pipe"],
	Params: [
		{ name: "season", type: "number" },
		{ name: "year", type: "number" },
		{ name: "weather", type: "boolean" }
	] as const,
	Whitelist_Response: null,
	Code: (async function formula1 (context, ...args) {
		const type = args.at(0) ?? FormulaOneSubcommands.default.name;
		const subcommand = FormulaOneSubcommands.get(type);
		if (!subcommand) {
			return {
				success: false,
				reply: `Invalid subcommand provided! Use one of ${FormulaOneSubcommands.names.join(", ")}`
			};
		}

		const rest = args.slice(1);
		return await subcommand.execute.call(this, context, type, ...rest);
	}),
	Dynamic_Description: async () => {
		const subcommandDescriptions = await FormulaOneSubcommands.createDescription();
		return [
			"All things F1-related in a single command.",
			`Powered by <a href="https://api.jolpi.ca/ergast/">Jolpica Developer API</a>`,
			`If you have any suggestions, addition ideas or anything else, make sure to let me know via the <a href="https://supinic.com/bot/command/detail/suggest">$suggest</a> command!`,
			"",

			...subcommandDescriptions
		];
	}
});

export default formulaOneCommandDefinition;
