import { fetchSevenTvChannelData } from "./index.js";
import type { SevenTvSubcommandDefinition } from "../index.js";

export default {
	name: "check",
	title: "Check current emotes",
	aliases: ["list"],
	default: false,
	description: [],
	getDescription: () => [
		"Posts the list of the rotating 7TV emotes in the current channel."
	],
	execute: async (context) => {
		if (!context.channel) {
			return {
				success: false,
				reply: "This command cannot be used in PMs!"
			};
		}

		const { emotes } = await fetchSevenTvChannelData(context.channel);
		if (emotes.length === 0) {
			return {
				success: true,
				reply: "There are no rotating 7TV emotes set up in this channel right now."
			};
		}

		const names = emotes.sort((a, b) => a.added - b.added).map(i => i.name).join(" ");
		return {
			success: true,
			reply: `Current rotating emotes (oldest to newest): ${names}`
		};
	}
} satisfies SevenTvSubcommandDefinition;
