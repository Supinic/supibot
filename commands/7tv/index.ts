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

		let subcommand;
		if (!type && args.length === 0) {
			// Handling a bare "$7tv" invocation as "$7tv check"
			subcommand = SevenTvSubcommands.getAsserted("check");
		}
		else {
			subcommand = SevenTvSubcommands.get(type);
			if (!subcommand) {
				const defaultSubcommand = SevenTvSubcommands.default;
				return await defaultSubcommand.execute.call(this, context, defaultSubcommand.name, type, ...args);
			}
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
