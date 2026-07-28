import { declare, type SubcommandDefinition } from "../../classes/command.js";
import { PathOfExileSubcommands } from "./subcommands/index.js";

export type PathOfExileSubcommandDefinition = SubcommandDefinition<typeof pathOfExileCommandDefinition>;

const pathOfExileCommandDefinition = declare({
	Name: "poe",
	Aliases: ["poe2"],
	Author: "supinic",
	Cooldown: 7500,
	Description: "A collection of various Path of Exile-related commands. Check the extended help on the website for more info.",
	Flags: ["mention", "non-nullable", "pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function poe (context, ...args) {
		const type = args.at(0) ?? PathOfExileSubcommands.default.name;
		const subcommand = PathOfExileSubcommands.get(type);
		if (!subcommand) {
			return {
				success: false,
				reply: `Invalid subcommand provided! Use one of ${PathOfExileSubcommands.names.join(", ")}`
			};
		}

		const rest = args.slice(1);
		return await subcommand.execute.call(this, context, type, ...rest);
	}),
	Dynamic_Description: async () => {
		const description = await PathOfExileSubcommands.createDescription();
		return [
			"Multiple commands related to Path of Exile.",
			"",

			...description
		];
	}
});

export default pathOfExileCommandDefinition;
