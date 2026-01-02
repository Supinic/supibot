import type { CheckSubcommandDefinition } from "../index.js";
import { TWITCH_ANTIPING_CHARACTER } from "../../../utils/command-utils.js";

export default {
	name: "ambassador",
	aliases: ["ambassadors"],
	title: "Channel ambassadors",
	description: [],
	getDescription: (prefix) => [
		`<code>${prefix}check ambassadors</code>`,
		`Posts a list of Supibot Ambassadors in the current channel.`,
		"",

		`<code>${prefix}check ambassadors (channel name)</code>`,
		`Posts a list of Supibot Ambassadors in provided channel.`
	],
	execute: async (context, identifier) => {
		if (!identifier && !context.channel) {
			return {
				success: false,
				reply: `You must a provide a channel when using this command in private messages!`
			};
		}

		const channelData = (identifier)
			? sb.Channel.get(identifier)
			: context.channel;

		if (!channelData) {
			return {
				success: false,
				reply: "Provided channel does not exist!"
			};
		}

		const rawAmbassadors = await channelData.getDataProperty("ambassadors");
		if (!rawAmbassadors || rawAmbassadors.length === 0) {
			const prefix = (context.channel === channelData) ? "This" : "Target";
			return {
				reply: `${prefix} channel has no ambassadors.`
			};
		}

		const ambassadors = await sb.User.getMultiple(rawAmbassadors);
		const namesList = ambassadors.map(i => `${i.Name[0]}${TWITCH_ANTIPING_CHARACTER}${i.Name.slice(1)}`);
		return {
			meta: {
				skipWhitespaceCheck: true
			},
			reply: `Active ambassadors in channel ${channelData.Name}: ${namesList.join(", ")}`
		};
	}
} satisfies CheckSubcommandDefinition;
