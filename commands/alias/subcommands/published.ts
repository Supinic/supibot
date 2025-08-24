import { type AliasSubcommandDefinition } from "../index.js";
import { prefix } from "../../../utils/command-utils.js";

export default {
	name: "published",
	title: "Publish alias in a channel",
	aliases: [],
	default: false,
	description: [
		`<code>${prefix}alias published</code>`,
		"Lists the currently published channel aliases in the current channel"
	],
	execute: function (context) {
		if (!context.channel) {
			return {
				success: false,
				reply: `There are no channel-published aliases in private messages!`
			};
		}

		return {
			success: true,
			reply: `List of published aliases in this channel: https://supinic.com/bot/channel/detail/${context.channel.ID}/alias/list`
		};
	}
} satisfies AliasSubcommandDefinition;
