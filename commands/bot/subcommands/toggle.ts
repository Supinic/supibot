import type { BotSubcommandDefinition } from "../index.ts";

export default {
	name: "toggle",
	title: "Temporarily disable/re-enable the bot",
	aliases: ["enable", "disable"],
	getDescription: (prefix) => [
		`<code>${prefix}bot disable</code>`,
		`<code>${prefix}bot disable channel:(name)</code>`,
		"After a 5 second timeout, disables the bot given channel until enabled again.",
		"If no channel is provided, the current is used.",
		"",

		`<code>${prefix}bot enable supinic</code>`,
		`<code>${prefix}bot enable channel:(name)</code>`,
		"If the bot has been disabled in the given channel, this command will re-enable it.",
		"This also fixes other minor problems with the bot not replying."
	],
	execute: ({ context }, subcommand) => {
		const { params } = context;
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const channelData = (params.channel) ? sb.Channel.getAsserted(params.channel) : context.channel!;
		const channelString = (channelData === context.channel) ? "this channel" : `channel "${channelData.Name}"`;

		if (subcommand === "disable") {
			if (channelData.Mode === "Read") {
				return {
					success: false,
					reply: "That channel is already set to read-only mode!"
				};
			}

			setTimeout(() => (channelData.Mode = "Read"), 5000);

			return {
				success: true,
				reply: core.Utils.tag.trim `
					I will go to read-only mode in ${channelString} after 5 seconds.
					Use the "${sb.Command.prefix}bot enable ${channelData.Name}" command in private messages to re-enable me.
				`
			};
		}
		else if (subcommand === "enable") {
			if (channelData.Mode !== "Read") {
				return {
					success: false,
					reply: `I'm already active in ${channelString}!`
				};
			}

			channelData.Mode = "Write";
			return {
				success: true,
				reply: `I successfully disabled the read-only mode in ${channelString}, and will respond to messages again.`
			};
		}
		else {
			return {
				success: false,
				reply: `Use either "$bot disable" or "$bot enable"!`
			};
		}
	}
} satisfies BotSubcommandDefinition;
