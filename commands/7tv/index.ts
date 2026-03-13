import { declare, type SubcommandDefinition } from "../../classes/command.js";
import { SevenTvSubcommands } from "./subcommands/index.js";

export type SevenTvSubcommandDefinition = SubcommandDefinition<typeof aliasCommandDefinition>;

const aliasCommandDefinition = declare({
	Name: "7tv",
	Aliases: null,
	Cooldown: 10000,
	Description: "",
	Flags: ["whitelist"],
	Params: [],
	Whitelist_Response: null,
	Code: async function sevenTv (context, type, ...args) {
		if (context.platform.name !== "twitch") {
			return {
				success: false,
				reply: "This command is only usable on Twitch!"
			};
		}

		const subcommand = SevenTvSubcommands.get(type);
		if (!subcommand) {
			return await SevenTvSubcommands.default.execute.call(this, context, type, ...args);
		}

		return await subcommand.execute.call(this, context, ...args);
	},
	Dynamic_Description: (prefix) => []
});

export default aliasCommandDefinition;
