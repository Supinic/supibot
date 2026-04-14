import { fetchSevenTvChannelData, SEVEN_TV_DEFAULT_LIMIT } from "./index.js";
import type { SevenTvSubcommandDefinition } from "../index.js";

const MAX_EMOTE_LIMIT = 250;

export default {
	name: "limit",
	title: "Change the amount of emotes",
	aliases: ["amount"],
	default: false,
	description: [],
	getDescription: (prefix) => [
		"Adjusts the amount (or limit) of emotes in the rotating list.",
		"",

		`<code>${prefix}7tv limit (number)</code>`,
		`<code>${prefix}7tv limit 10</code>`,
		`<code>${prefix}7tv amount 10</code>`,
		"Sets the amount of emotes in the list."
	],
	execute: async (context, type, rawLimit) => {
		if (!context.channel) {
			return {
				success: false,
				reply: "This command cannot be used in PMs!"
			};
		}

		const localData = await fetchSevenTvChannelData(context.channel);
		if (typeof rawLimit !== "string") {
			return {
				success: true,
				reply: `Current amount: ${localData.limit ?? SEVEN_TV_DEFAULT_LIMIT} emotes.`
			};
		}

		const permissions = await context.getUserPermissions();
		if (permissions.flag < sb.User.permissions.ambassador) {
			return {
				success: false,
				reply: "You can't change the amount! Only ambassadors and channel owners can."
			};
		}

		const limit = Number(rawLimit);
		if (!core.Utils.isValidInteger(limit, 1) || limit > MAX_EMOTE_LIMIT) {
			return {
				success: false,
				reply: `Your provided amount is not valid! It should an integer value between 1 and ${MAX_EMOTE_LIMIT} (inclusive).`
			};
		}

		localData.limit = limit;
		await context.channel.setDataProperty("sevenTvRotatingEmotes", localData);

		return {
			success: true,
			reply: `Successfully set the amount of rotating emotes to ${limit}.`
		};
	}
} satisfies SevenTvSubcommandDefinition;
