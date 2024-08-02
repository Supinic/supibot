module.exports = {
	name: "enable-rustlog",
	aliases: [],
	description: [
		`<code>$bot enable-rustlog</code>`,
		`<code>$bot enable-rustlog channel:(channel)</code>`,
		"Enables the 3rd party Rustlog service in either the current, or in a provided channel.",
		`This service gathers the chat logs in the channel, which are then used in Supibot for the <code>$randomline</code> command.`,
	],
	execute: async (context, options = {}) => {
		const { channelData } = options;
		if (channelData.Platform.Name !== "twitch") {
			return {
				success: false,
				reply: `Cannot enable the Rustlog logging service outside of Twitch!`
			};
		}

		let Rustlog;
		try {
			Rustlog = require("../../randomline/rustlog.js");
		}
		catch {
			return {
				success: false,
				reply: `Could not load the Rustlog methods module!`
			};
		}

		const channelID = channelData.Specific_ID;
		if (await Rustlog.isSupported(channelID)) {
			return {
				success: false,
				reply: `This channel is already added and configured in Rustlog!`
			};
		}

		const { reason, success, statusCode } = await Rustlog.addChannel(channelID);
		if (success) {
			return {
				reply: sb.Utils.tag.trim `
					Successfully added this channel to the Rustlog service!
					The $rl command should be enabled within approximately one minute.
				`
			};
		}
		else if (statusCode === 401 || reason === "no-key") {
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
};
