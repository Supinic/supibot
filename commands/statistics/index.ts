import { StatsSubcommands } from "./definitions/index.js";
import { type CommandDefinition, declare, type SubcommandDefinition } from "../../classes/command.js";

export type StatsSubcommandDefinition = SubcommandDefinition<typeof statisticsCommandDefinition>;

const statisticsCommandDefinition = declare({
	Name: "statistics",
	Aliases: ["stat", "stats"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts various statistics regarding you or other users, e.g. total AFK time.",
	Flags: ["mention", "pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function statistics (context, type, ...args) {
		if (!type) {
			return {
				reply: "No statistics type provided!",
				cooldown: { length: 2500 }
			};
		}

		const subcommand = StatsSubcommands.get(type.toLowerCase());
		if (!subcommand) {
			return {
				success: false,
				reply: "Invalid statistic type provided!"
			};
		}

		return await subcommand.execute.call(this, context, type, ...args);
	}),
	Dynamic_Description: async (prefix) => {
		const subcommandsDescription = await StatsSubcommands.createDescription();
		return [
			"Checks various statistics found around supibot's data, regarding you or a provided user - depending on the type used.",
			"",

			`<code>${prefix}stats (type)</code>`,
			"Statistics based on the type used",
			"",

			...subcommandsDescription
		];
	}
}) satisfies CommandDefinition;

export default statisticsCommandDefinition;
