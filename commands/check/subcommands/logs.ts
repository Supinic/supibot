import type { CheckSubcommandDefinition } from "../index.js";
import { isSupported } from "../../randomline/rustlog.js";
import { SupiError } from "supi-core";

export default {
	name: "logs",
	title: "Supibot channel logging",
	aliases: [],
	description: ["Checks the Supibot chat line logging status of the current channel."],
	execute: async (context) => {
		if (!context.channel) {
			return {
				success: false,
				reply: `You must use this command in the channel you want to check!`
			};
		}

		const arr: string[] = [];
		if (context.channel.Logging.has("Lines")) {
			arr.push("I am logging this channel's chat lines into a local database.");
		}
		else {
			arr.push("I am NOT logging this channel's chat lines into a local database.");
		}

		const oldLogsStatus = await context.channel.getDataProperty("logsRemovedReason");
		if (oldLogsStatus === "reinstated") {
			arr.push("I have logged this channel's chat lines before, and they have been reinstated to the IVR Rustlog service.");
		}
		else if (oldLogsStatus) {
			arr.push("I have logged this channel's chat lines before, and they COULD be reinstated to the IVR Rustlog service (create a $suggest if you would like to).");
		}
		else if (!context.channel.Logging.has("Lines")) {
			arr.push("I have NOT logged this channel's chat lines before.");
		}

		if (context.platform.Name === "twitch") {
			const platformId = context.channel.Specific_ID;
			if (!platformId) {
				throw new SupiError({
				    message: "Assert error: Twitch channel does not have a platform ID set up",
					args: { channelId: context.channel.ID }
				});
			}

			if (await isSupported(platformId)) {
				arr.push("This channel is being logged by the IVR Rustlog service.");
			}
			else {
				arr.push("This channel is NOT being logged by the IVR Rustlog service.");
			}
		}

		return {
			reply: arr.join(" ")
		};
	}
} satisfies CheckSubcommandDefinition;
