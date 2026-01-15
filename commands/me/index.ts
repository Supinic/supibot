import { declare } from "../../classes/command.js";

export default declare({
	Name: "me",
	Aliases: ["/me"],
	Cooldown: 5000,
	Description: "Turns the output into a \"/me\" message. E.g.: [Supibot] slaps someone around a bit with a large trout",
	Flags: [],
	Params: [],
	Whitelist_Response: null,
	Code: function me (context, ...args) {
		if (!context.channel) {
			return {
				success: false,
				reply: "This command is not usable in PMs!"
			};
		}

		if (!context.platform.supportsMeAction) {
			return {
				success: false,
				reply: `The /me action is not supported on this platform!`
			};
		}

		return {
			success: true,
			reply: args.join(" "),
			replyWithMeAction: true
		};
	},
	Dynamic_Description: null
});
