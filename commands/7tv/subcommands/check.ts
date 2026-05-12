import { fetchSevenTvChannelData } from "./index.js";
import type { SevenTvSubcommandDefinition } from "../index.js";

export default {
	name: "check",
	title: "Check current emotes",
	aliases: ["list"],
	default: false,
	description: [],
	getDescription: (prefix) => [
		"Posts the list of the rotating 7TV emotes in the current channel.",
		"The emotes will be posted oldest to newest.",
		"",

		`<code>${prefix}7tv</code>`,
		`<code>${prefix}7tv check</code>`,
		"Posts the list of current rotating emotes.",
		`You can also use the <code>${prefix}7tv</code> command with on its own (with no arguments) and it will post the list of emotes.`
	],
	execute: async (context, type, emote) => {
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

		const targetEmote = (emote)
			? emotes.find(i => i.name === emote)
			: null;

		if (targetEmote) {
			const { requester, added, name } = targetEmote;
			const delta = core.Utils.timeDelta(added);
			const who = (requester === context.user.Name) ? "you" : requester;
			return {
				success: true,
				reply: `${name} added by ${who} ${delta}.`
			};
		}
		else {
			const prefix = (emote) ? "Could not find your emote, so here's a list: " : "";
			const names = emotes.sort((a, b) => a.added - b.added).map(i => i.name).join(" ");
			return {
				success: true,
				reply: `${prefix}Current emotes (oldest to newest): ${names}`
			};
		}
	}
} satisfies SevenTvSubcommandDefinition;
