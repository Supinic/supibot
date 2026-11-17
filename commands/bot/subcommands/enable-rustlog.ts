import { addChannel, isChannelSupported } from "../../randomline/rustlog.ts";
import type { BotSubcommandDefinition } from "../index.ts";

export default {
	name: "enable-rustlog",
	title: "Enable chat line logging via Rustlog",
	aliases: [],
	default: false,
	getDescription: (prefix) => [
		`<code>${prefix}bot enable-rustlog</code>`,
		`<code>${prefix}bot enable-rustlog channel:(channel)</code>`,
		"Enables the 3rd party Rustlog service in either the current, or in a provided channel.",
		`This service gathers the chat logs in the channel, which are then used in Supibot for the <code>$randomline</code> command.`
	],
	execute: async (context) => {
		const { params } = context;
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const channelName = params.channel ?? context.channel!.Name;

		const platform = sb.Platform.getAsserted("twitch");
		const channelId = await platform.getUserID(channelName);
		if (!channelId) {
			return {
				success: false,
				reply: "That channel doesn't exist on Twitch, or is banned, or otherwise unavailable!"
			};
		}

		if (await isChannelSupported(channelId)) {
			return {
				success: false,
				reply: `This channel is already added and configured in Rustlog!`
			};
		}

		const result = await addChannel(channelId);
		if (result.success) {
			return {
				success: true,
				reply: "Successfully added this channel to the Rustlog service! The $rl command should be enabled within approximately one minute."
			};
		}

		const { statusCode } = result;
		if (statusCode === 401) {
			return {
				success: false,
				reply: "Authentication failure!"
			};
		}
		else if (statusCode === 403) {
			return {
				success: false,
				reply: `Cannot add this channel, as the owner has opted out from being logged by the Rustlog service!`
			};
		}
		else {
			return {
				success: false,
				reply: `Unexpected error occurred! Try again later. Status code: ${statusCode}`
			};
		}
	}
} satisfies BotSubcommandDefinition;
