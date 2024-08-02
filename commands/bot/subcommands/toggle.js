module.exports = {
	name: "toggle",
	aliases: ["enable", "disable"],
	description: [
		`<code>$bot disable</code>`,
		`<code>$bot disable channel:(name)</code>`,
		"After a 5 second timeout, disables the bot given channel until enabled again.",
		"If no channel is provided, the current is used.",
		"",

		`<code>$bot enable supinic</code>`,
		`<code>$bot enable channel:(name)</code>`,
		"If the bot has been disabled in the given channel, this command will re-enable it.",
		"This also fixes other minor problems with the bot not replying."
	],
	execute: async (context, options = {}) => {
		const { channelData, subcommand } = options;

		if (subcommand === "disable") {
			if (channelData.Mode === "Read") {
				return {
					success: false,
					reply: "That channel is already set to read-only mode!"
				};
			}

			setTimeout(() => (channelData.Mode = "Read"), 5000);

			return {
				reply: sb.Utils.tag.trim `
					I will go to read-only mode in channel "${channelData.Name}" after ~5 seconds.
					Use the "${sb.Command.prefix}${this.Name} enable ${channelData.Name}" command in private messages to re-enable me.
				`
			};
		}
		else if (subcommand === "enable") {
			if (channelData.Mode !== "Read") {
				return {
					success: false,
					reply: `I'm already active in channel "${channelData.Name}"!`
				};
			}

			channelData.Mode = "Write";
			return {
				reply: "I successfully disabled read-only mode and will respond to messages again."
			};
		}
		else {
			return {
				success: false,
				reply: `Use either "$bot disable" or "$bot enable"!`
			};
		}
	}
};
