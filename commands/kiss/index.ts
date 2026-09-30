import { declare } from "../../classes/command.ts";

const KISS_EMOJIS = ["👩‍❤️‍💋‍👨", "💋", "😗", "👩‍❤️‍💋‍👨", "😙", "😚", "😽", "💋😳", "👨‍❤️‍💋‍👨"] as const;

export default declare({
	Name: "kiss",
	Aliases: null,
	Cooldown: 10000,
	Description: "Kisses target user.",
	Flags: ["opt-out", "pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: function kiss (context, user, emote) {
		if (!user || user.toLowerCase() === context.user.Name) {
			return {
				success: false,
				reply: "You can't really kiss yourself! 😕"
			};
		}

		if (user === context.platform.Self_Name) {
			return {
				success: true,
				reply: "😊"
			};
		}

		const string = (emote)
			? `${emote} 💋`
			: core.Utils.randArray(KISS_EMOJIS);

		return {
			success: true,
			reply: `${context.user.Name} kisses ${user} ${string}`
		};
	},
	Dynamic_Description: null
});
