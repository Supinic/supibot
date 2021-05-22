module.exports = {
	Name: "kiss",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Kisses target user.",
	Flags: ["opt-out","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (() => ({
		emojis: ["👩‍❤️‍💋‍👨", "💋", "😗", "👩‍❤️‍💋‍👨", "😙", "😚", "😽", "💋😳", "👨‍❤️‍💋‍👨"]
	})),
	Code: (async function kiss (context, user, emote) {
		if (!user || user.toLowerCase() === context.user.Name) {
			return {
				reply: "You can't really kiss yourself 😕"
			};
		}
		else if (user === context.platform.Self_Name) {
			return {
				reply: "😊"
			};
		}
		else {
			const string = (emote)
				? `${emote} 💋`
				: sb.Utils.randArray(this.staticData.emojis);
	
			return {
				reply: `${context.user.Name} kisses ${user} ${string}`
			};
		}
	}),
	Dynamic_Description: null
};
