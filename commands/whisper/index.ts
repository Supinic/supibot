import { declare } from "../../classes/command.js";

export default declare({
	Name: "whisper",
	Aliases: ["/w", "pm"],
	Cooldown: 1000,
	Description: "Instead of replying in the given channel, this command will make the bot whisper you the response. Only usable in pipes.",
	Flags: [],
	Params: [],
	Whitelist_Response: null,
	Code: function whisper (context, ...args) {
		if (!context.append.pipe) {
			return {
				success: false,
				reply: "This command is only usable in pipes!",
				cooldown: 5000
			};
		}

		return {
			reply: `Result of your command: ${args.join(" ")}`,
			replyWithPrivateMessage: true
		};
	},
	Dynamic_Description: null
});
