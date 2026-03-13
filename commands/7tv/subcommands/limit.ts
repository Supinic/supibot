import { fetchSevenTvChannelData } from "./index.js";
import type { SevenTvSubcommandDefinition } from "../index.js";

const MAX_EMOTE_LIMIT = 250;
export default {
	name: "limit",
	title: "Changes the amount of rotating 7TV emotes.",
	aliases: ["amount"],
	default: false,
	description: [],
	getDescription: (prefix) => [
		"Adjusts the amount (or limit) of emotes in the rotating list.",
		"",

		`<code>${prefix}7tv limit (number)`,
		`<code>${prefix}7tv limit 10`,
		`<code>${prefix}7tv amount 10`,
		"Sets the amount of emotes in the list."
	],
	execute: async (context, rawLimit) => {
		if (!context.channel) {
			return {
				success: false,
				reply: "This command cannot be used in PMs!"
			};
		}

		const permissions = await context.getUserPermissions();
		if (permissions.flag < sb.User.permissions.ambassador) {
			return {
				success: false,
				reply: "You can't use this command here! Only ambassadors and channel owners can."
			};
		}

		const limit = Number(rawLimit);
		if (!core.Utils.isValidInteger(limit, 1)) {
			return {
				success: false,
				reply: "Your provided amount is not valid! It must be a positive integer."
			};
		}
		else if (limit >= MAX_EMOTE_LIMIT) {
			return {
				success: false,
				reply: `Your provided amount is too large! It should be at most ${MAX_EMOTE_LIMIT}.`
			};
		}

		const localData = await fetchSevenTvChannelData(context.channel);
		localData.limit = limit;
		await context.channel.setDataProperty("sevenTvRotatingEmotes", localData);

		return {
			success: true,
			reply: `Successfully set the amount of rotating emotes to ${limit}.`
		};
	}
} satisfies SevenTvSubcommandDefinition;
