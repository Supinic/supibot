import { declare, type SubcommandDefinition } from "../../classes/command.js";
import { CheckSubcommands } from "./subcommands/index.js";

export type CheckSubcommandDefinition = SubcommandDefinition<typeof checkCommandDefinition>;

const checkCommandDefinition = declare({
	Name: "check",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Checks certain user or system variables. For a list of types, check the command's extended help.",
	Flags: ["mention","pipe"],
	Params: [{ name: "index", type: "number" }] as const,
	Whitelist_Response: null,
	Code: (async function check (context, type, identifier) {
		if (!type) {
			return {
				success: false,
				reply: `You must provide something to check for! Check here for more info: ${this.getDetailURL()}`
			};
		}

		const subcommand = CheckSubcommands.get(type);
		if (!subcommand) {
			return {
				success: false,
				reply: `Invalid item to check provided! Check here for more info: ${this.getDetailURL()}`
			};
		}

		return await subcommand.execute.call(this, context, identifier);
	}),
	Dynamic_Description: async (prefix) => {
		// no need to pass the command itself as param, since no subcommands are executed
		const descriptions = await CheckSubcommands.createDescription();

		return [
			"Checks the status of variables, items or other values set within Supibot",
			"",

			`<code>${prefix}check (variable)</code>`,
			"Checks the status of a given item.",
			"",

			"Supported items:",
			...descriptions
		];
	}
});

export default checkCommandDefinition;
