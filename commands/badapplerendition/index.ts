import { declare, type SubcommandDefinition } from "../../classes/command.js";
import { BadAppleSubcommands } from "./subcommands/index.js";

export type BadAppleSubcommandDefinition = SubcommandDefinition<typeof badAppleCommandDefinition>;
export type BadAppleRow = {
	ID: number;
	Device: string;
	Timestamp: number | null;
	Link: string;
};

const badAppleCommandDefinition = declare({
	Name: "badapplerendition",
	Aliases: ["badapple", "bar"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Aggregate command for anything regarding the Bad Apple!! rendition list on the website.",
	Flags: ["mention", "pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: async function badAppleRendition (context, commandName, ...args) {
		if (!commandName) {
			return {
				success: false,
				reply: `No command provided! Use one of these: ${BadAppleSubcommands.names.join(", ")}`
			};
		}

		const subcommand = BadAppleSubcommands.get(commandName);
		if (!subcommand) {
			return {
				success: false,
				reply: `Unknown command provided! Use one of these: ${BadAppleSubcommands.names.join(", ")}`
			};
		}

		return await subcommand.execute.call(this, context, ...args);
	},
	Dynamic_Description: async () => {
		const description = await BadAppleSubcommands.createDescription();
		return [
			"Aggregate command for all things Bad Apple!! related.",
			"",

			...description
		];
	}
});

export default badAppleCommandDefinition;
