import type { BotSubcommandDefinition } from "../index.ts";

export default {
	name: "rejoin",
	title: "Rejoin a channel after a ban etc.",
	aliases: [],
	getDescription: (prefix) => [
		`<code>${prefix}bot rejoin channel:(channel)</code>`,
		"If your Twitch channel got suspended and recently unbanned, you can use this command to get Supibot back immediately!",
		"This also works for other channels that you are an ambassador in.",
		"Also works for when the bot is banned by accident - just gotta make sure it's still modded or permitted before re-joining"
	],
	execute: async (context) => {
		const { params } = context;
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const channelData = (params.channel) ? sb.Channel.getAsserted(params.channel) : context.channel!;

		if (channelData.Platform.Name !== "twitch") {
			return {
				success: false,
				reply: `Re-enabling the bot is currently only available for Twitch channels!`
			};
		}

		const inactiveReason = await channelData.getDataProperty("inactiveReason");
		if (inactiveReason === "withdrawn") {
			return {
				success: false,
				cooldown: 60_000,
				reply: `I have been withdrawn from this channel and cannot be re-added back automatically!`
			};
		}

		const offlineConfiguration = await channelData.getDataProperty("offlineOnlyBot");
		if (channelData.Mode === "Read" && offlineConfiguration) {
			await channelData.setDataProperty("offlineOnlyBot", null);
			await channelData.saveProperty("Mode", offlineConfiguration.mode);

			return {
				success: true,
				reply: core.Utils.tag.trim `
					I rejoined channel "${channelData.Name}" immediately.
					It was in read-only mode because someone used "$bot disable" before.
					Next time, you can just do "$bot enable".
				`
			};
		}

		const twitch = sb.Platform.getAsserted("twitch");
		const channelId = await twitch.getUserID(channelData.Name);
		if (!channelId) {
			return { // probably more of an assert error
				success: false,
				reply: "Cannot that rejoin that channel!"
			};
		}

		const results = await twitch.joinChannel(channelId);
		const [messageResponse, onlineResponse, offlineResponse] = results.map(i => i.response);

		if (messageResponse.ok) {
			if (channelData.Mode === "Inactive") {
				await channelData.saveProperty("Mode", "Write");
			}

			const hasNoScopeProperty = await channelData.getDataProperty("twitchNoScopeDisabled");
			if (hasNoScopeProperty) {
				await channelData.setDataProperty("twitchNoScopeDisabled", null);
			}

			return {
				success: true,
				reply: `Rejoined channel channel "${channelData.Name}" successfully.`
			};
		}
		else if (messageResponse.statusCode === 403) {
			return {
				success: false,
				reply: `I could not rejoin channel channel "${channelData.Name}"! Make sure to either permit me via Supinic's website https://supinic.com/bot/twitch-auth or set me as a moderator.`
			};
		}
		else if (messageResponse.statusCode === 409) { // 409 Conflict
			if (channelData.Mode === "Inactive") {
				await channelData.saveProperty("Mode", "Write");
			}

			if (onlineResponse.statusCode === 202 || offlineResponse.statusCode === 202) {
				return {
					success: true,
					reply: `My message connection was already set up, but I set up checking for when the stream goes online or offline.`
				};
			}

			return {
				success: false,
				reply: "My connections are already set up, everything should work fine!"
			};
		}
		else {
			return {
				success: false,
				reply: `Something else went wrong when trying to rejoin! Try again later.`
			};
		}
	}
} satisfies BotSubcommandDefinition;
