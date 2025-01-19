import { subcommands } from "./subcommands/index.js";

export default {
	Name: "bot",
	Aliases: null,
	Author: "supinic",
	Cooldown: 2500,
	Description: "Allows channel owners and Supibot ambassadors to set various parameters for the bot, for their managed channel.",
	Flags: ["mention","pipe","skip-banphrase"],
	Params: [
		{ name: "channel", type: "string" },
		{ name: "mode", type: "string" },
		{ name: "url", type: "string" }
	],
	Whitelist_Response: null,
	Code: (async function bot (context, command, value) {
		const { params } = context;
		if (!command) {
			return {
				success: false,
				reply: "No sub-command provided! Check the command's extended help for more info."
			};
		}

		const subcommand = subcommands.find(i => i.name === command || i.aliases?.includes(command));
		if (!subcommand) {
			return {
				success: false,
				reply: "Invalid command provided!"
			};
		}

		const channelData = (params.channel || value)
			? sb.Channel.get(params.channel ?? value)
			: context.channel;

		if (!channelData) {
			const channelName = params.channel ?? value ?? context.channel?.Name ?? null;
			if (command.includes("join") && channelName && channelName.toLowerCase() === context.user.Name) {
				return {
					success: false,
					reply: `I can't rejoin your channel, you haven't requested me yet! To request me in your channel, use this form: https://supinic.com/bot/request-bot/form`
				};
			}

			return {
				success: false,
				reply: "Invalid or no channel provided!"
			};
		}

		const permissions = await context.getUserPermissions({ channel: channelData });
		if (permissions.flag === sb.User.permissions.regular) {
			return {
				success: false,
				reply: sb.Utils.tag.trim `
					You're not authorized to do that in channel "${channelData.Name}"!
					You should ask the broadcaster or an ambassador to do this instead.
					If you want a different channel, use the channel:channel_name parameter.
				`
			};
		}

		return await subcommand.execute(context, {
			channelData,
			subcommand: command
		});
	}),
	Dynamic_Description: (async function () {
		const subcommandDescriptions = subcommands.map(cmd => cmd.description.join("<br>")).join("<br><br>");
		return [
			"Various bot configuration related commands.",
			"For a given channel, only its owner or ambassadors can use this command.",
			`All sub-commands listed accept the "channel:(name)" parameter, if you want to configure a channel outside of the channel itself.`,
			"",

			subcommandDescriptions
		];
	})
};
