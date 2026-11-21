import { BotSubcommands } from "./subcommands/index.ts";
import { declare, type SubcommandDefinition } from "../../classes/command.ts";
import { BadAppleSubcommands } from "../badapplerendition/subcommands/index.ts";

export type BotSubcommandDefinition = SubcommandDefinition<typeof botCommandDefinition>;

const botCommandDefinition = declare({
	Name: "bot",
	Aliases: null,
	Cooldown: 2500,
	Description: "Allows channel owners and Supibot ambassadors to set various parameters for the bot, for their managed channel.",
	Flags: ["mention", "pipe", "skip-banphrase"],
	Params: [
		{ name: "channel", type: "string" },
		{ name: "mode", type: "string" },
		{ name: "url", type: "string" }
	],
	Whitelist_Response: null,
	Code: (async function bot (context, commandName, ...args) {
		if (!commandName) {
			return {
				success: false,
				reply: "No sub-command provided! Check the command's extended help for more info."
			};
		}

		const { params } = context;
		const channelData = (params.channel) ? sb.Channel.get(params.channel) : context.channel;
		if (!channelData) {
			return {
				success: false,
				reply: "When using this command in PMs, you must provide the channel! Use the channel:target_channel parameter."
			};
		}

		const permissions = await context.getUserPermissions({ channel: channelData });
		if (permissions.flag === sb.User.permissions.regular) {
			return {
				success: false,
				reply: core.Utils.tag.trim `
					You're not authorized to do that in channel "${channelData.Name}"!
					You should ask the broadcaster or an ambassador to do this instead.
					If you want a different channel, use the channel:channel_name parameter.
				`
			};
		}

		const subcommand = BotSubcommands.get(commandName);
		if (!subcommand) {
			return {
				success: false,
				reply: `Unknown command provided! Use one of these: ${BotSubcommands.names.join(", ")}`
			};
		}

		return await subcommand.execute.call(this, context, commandName, ...args);
	}),
	Dynamic_Description: async () => {
		const description = await BadAppleSubcommands.createDescription();
		return [
			"Various bot configuration related commands.",
			"For a given channel, only its owner or ambassadors can use this command.",
			`All sub-commands listed accept the "channel:(name)" parameter, if you want to configure a channel outside of the channel itself.`,
			"",

			...description
		];
	}
});

export default botCommandDefinition;
