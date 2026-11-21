import type { BotSubcommandDefinition } from "../index.ts";

export default {
	name: "rename",
	title: "Return the bot back after a Twitch rename",
	aliases: ["renamed"],
	getDescription: (prefix) => [
		`<code>${prefix}bot rename channel:(channel)</code>`,
		`<code>${prefix}bot renamed channel:(channel)</code>`,
		"If you recently renamed your Twitch account, you can use this command to get Supibot back immediately!",
		"This also works for other channels that you are an ambassador in."
	],
	execute: async (context) => {
		const { params } = context;
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const channelData = (params.channel) ? sb.Channel.getAsserted(params.channel) : context.channel!;
		if (channelData.Platform.Name !== "twitch") {
			return {
				success: false,
				reply: `Adding me back to recently renamed channels is only available on Twitch!`
			};
		}

		const specificId = channelData.Specific_ID;
		if (!specificId) {
			return {
				success: false,
				reply: "Your channel does not have Twitch ID associated with it! Try again later."
			};
		}
		
		const platform = sb.Platform.getAsserted("twitch");
		const newTwitchName = await platform.fetchUsernameByUserPlatformID(channelData.Specific_ID);
		if (!newTwitchName) {
			return {
				success: false,
				reply: "This channel doesn't seem to exist on Twitch anymore!"
			};
		}
		else if (newTwitchName !== channelData.Name) {
			const oldName = channelData.Name;
			const { exists } = await platform.fixChannelRename(channelData, newTwitchName, channelData.Specific_ID);
			if (exists) {
				return {
					success: false,
					reply: `The channel name ${newTwitchName} already exists in my database! Please contact @Supinic - this needs to be resolved manually.`
				};
			}
			else {
				return {
					success: true,
					reply: `Channel succesfully renamed: ${oldName} → ${newTwitchName}`
				};
			}
		}
		else {
			return {
				success: true,
				reply: "All good, nothing needs to be done."
			};
		}
	}
} satisfies BotSubcommandDefinition;
