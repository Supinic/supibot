import type { StatsSubcommandDefinition } from "../index.js";

export default {
	name: "discord",
	aliases: [],
	title: "Discord server count",
	description: [],
	getDescription: (prefix) => [
		`<code>${prefix}stats discord</code>`,
		"Posts how many Discord servers Supibot is currently in."
	],
	execute: async () => {
		const { client } = sb.Platform.getAsserted("discord");
		const guilds = await client.guilds.fetch();

		return {
			success: true,
			reply: `Supibot is currently available in ${guilds.size}/100 Discord servers.`
		};
	}
} satisfies StatsSubcommandDefinition;
