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

		return await subcommand.execute.call(this, context, type, ...args);
	},
	Dynamic_Description: async () => {
		const descriptions = await SevenTvSubcommands.createDescription();
		return [
			"This command lets you manage a so-called rotating list of 7TV emotes, where users can add a 7TV emote of their choosing to the channel's emotes.",
			"The list of emotes is capped by a limit, and any emotes above that limit will cause the oldest added emote to be removed.",
			"",

			...descriptions
		];
	}
});

export default aliasCommandDefinition;
