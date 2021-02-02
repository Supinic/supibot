module.exports = {
	Name: "whisper",
	Aliases: ["/w","pm"],
	Author: "supinic",
	Cooldown: 1000,
	Description: "Usable in pipe only - turns the response into a whisper.",
	Flags: ["pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function whisper (context, ...args) {
		if (!context.append.pipe) {
			return {
				reply: "This command is only usable in pipes!",
				cooldown: 5000
			};
		}
	
		return {
			reply: "Result of your pipe: " + args.join(" "),
			replyWithPrivateMessage: true
		}
	}),
	Dynamic_Description: null
};