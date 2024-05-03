module.exports = {
	Name: "me",
	Aliases: ["/me"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Turns the output into a \"/me\" message. E.g.: [Supibot] slaps someone around a bit with a large trout",
	Flags: [],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function me (context, ...args) {
		if (!context.channel) {
			return {
				success: false,
				reply: "This command is not usable in PMs!",
				cooldown: 5000
			};
		}

		if (context.platform.supportsMeAction !== true) {
			return {
				success: false,
				reply: `The /me action is not supported on this platform!`
			};
		}

		return {
			reply: args.join(" "),
			replyWithMeAction: true
		};
	}),
	Dynamic_Description: null
};
