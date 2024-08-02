module.exports = {
	name: "rejoin",
	aliases: ["i-will-not-ban-supibot-again"],
	description: [
		`<code>$bot rejoin channel:(channel)</code>`,
		"If your Twitch channel got suspended and recently unbanned, you can use this command to get Supibot back immediately!",
		"This also works for other channels that you are an ambassador in.",
		"",

		`<code>$bot i-will-not-ban-supibot-again channel:(channel)</code>`,
		`If the bot has been banned in the channel, and unbanned rather quickly (not more than ~1 hour), you can use this command to attempt to have Supibot re-join.`,
		"Should the ban last for too long, Supibot will be unable to join automatically.",
		"It will then mention that you have to create a suggestion and describe what happened."
	],
	execute: async (context, options = {}) => {
		const { channelData, subcommand } = options;
		
		if (channelData.Platform.Name !== "twitch") {
			return {
				success: false,
				reply: `Re-enabling the bot is currently only available for Twitch channels!`
			};
		}

		const inactiveReason = await channelData.getDataProperty("inactiveReason");
		if (inactiveReason === "bot-banned" && subcommand !== "i-will-not-ban-supibot-again") {
			return {
				success: false,
				reply: sb.Utils.tag.trim `
					I have been banned in channel "${channelData.Name}" for too long!
					You must use this command instead → $bot i-will-not-ban-supibot-again channel:${channelData.Name}
				`
			};
		}
		else if (inactiveReason === "withdrawn") {
			return {
				success: false,
				cooldown: 60_000,
				reply: `I have been withdrawn from this channel and cannot be re-added back manually!`
			};
		}

		const offlineConfiguration = await channelData.getDataProperty("offlineOnlyBot");
		if (channelData.Mode === "Read" && offlineConfiguration) {
			await channelData.setDataProperty("offlineOnlyBot", null);
			await channelData.saveProperty("Mode", offlineConfiguration.mode ?? "Write");

			return {
				reply: sb.Utils.tag.trim `
					I rejoined channel "${channelData.Name}" immediately.
					It was in read-only mode because someone used "$bot disable" before.
					Next time, you can just do "$bot enable".
				`
			};
		}

		/** @type {TwitchPlatform} */
		const twitch = sb.Platform.get("twitch");
		const results = await twitch.joinChannel(channelData.Specific_ID);
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
				reply: `Rejoined channel channel "${channelData.Name}" successfully.`
			};
		}
		else if (messageResponse.statusCode === 403) {
			return {
				success: false,
				reply: `I could not rejoin channel channel "${channelData.Name}"! Make sure to either permit me via Supinic's website or set me as a moderator.`
			};
		}
		else if (messageResponse.statusCode === 409) {
			if (channelData.Mode === "Inactive") {
				await channelData.saveProperty("Mode", "Write");
			}

			if (onlineResponse.statusCode === 202 || offlineResponse.statusCode === 202) {
				return {
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
};
