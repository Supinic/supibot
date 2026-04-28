import { fetchSevenTvChannelData, fetchSevenTvToken, removeEmote } from "./index.js";
import type { SevenTvSubcommandDefinition } from "../index.js";

export default {
	name: "remove",
	title: "Remove an emote",
	aliases: [],
	default: false,
	description: [],
	getDescription: (prefix) => [
		"Removes an emote that's currently in the list.",
		"Users can only remove emotes added by themselves; ambassadors and channel owners can remove any of them.",

		`<code>${prefix}7tv remove (emote name)</code>`,
		`Removes a given emote from the list.`
	],
	execute: async (context, type, ...args) => {
		if (!context.channel) {
			return {
				success: false,
				reply: "This command cannot be used in PMs!"
			};
		}

		const emote = args.at(0);
		if (!emote) {
			return {
				success: false,
				reply: "You must provide an emote name!"
			};
		}

		const localData = await fetchSevenTvChannelData(context.channel);
		const index = localData.emotes.findIndex(i => i.name === emote);
		if (index === -1) {
			return {
				success: false,
				reply: "Your provided emote is either not added or is not a part of the rotating list!"
			};
		}

		const emoteData = localData.emotes[index];
		const permissions = await context.getUserPermissions();
		if (emoteData.requester !== context.user.Name && permissions.flag < sb.User.permissions.ambassador) {
			return {
				success: false,
				reply: "You cannot remove that emote because you didn't request it!"
			};
		}

		const token = fetchSevenTvToken();
		const result = await removeEmote(token, emoteData.id, localData.emoteSetId);
		if (!result.success) {
			return {
				success: false,
				reply: `Could not add emote! Check if I am set up as the 7TV editor for this channel (error code ${result.statusCode})`
			};
		}

		localData.emotes.splice(index, 1);
		await context.channel.setDataProperty("sevenTvRotatingEmotes", localData);

		const who = (emoteData.requester === context.user.Name) ? "your" : `${context.user.Name}'s`;
		return {
			success: true,
			reply: `Successfully removed ${who} emote ${emote} from the list.`
		};
	}
} satisfies SevenTvSubcommandDefinition;
