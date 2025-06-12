export default {
	Name: "whisper",
	Aliases: ["/w", "pm"],
	Author: "supinic",
	Cooldown: 1000,
	Description: "Usable in pipe only - turns the response into a private message.",
	Flags: [],
	Params: [],
	Whitelist_Response: null,
	Code: (async function whisper (context, ...args) {
		if (!context.append.pipe) {
			return {
				success: false,
				reply: "This command is only usable in pipes!",
				cooldown: 5000
			};
		}

		return {
			reply: `Result of your pipe: ${args.join(" ")}`,
			replyWithPrivateMessage: true
		};
	}),
	Dynamic_Description: null
};
