module.exports = {
	Name: "vanish",
	Aliases: null,
	Author: "supinic",
	Cooldown: 60000,
	Description: "Times out the user for 1 second. Only works if Supibot is a Twitch moderator.",
	Flags: ["skip-banphrase"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function vanish (context) {
		if (context.channel === null || context.channel.Mode !== "Moderator") {
			return {
				success: false,
				reply: "You cannot vanish here!"
			};
		}
		else if (context.platform.Name !== "twitch") {
			return {
				success: false,
				reply: "You cannot vanish outside of Twitch!"
			};
		}
		else if (context.append.userBadges.hasModerator) {
			return {
				success: false,
				reply: "I cannot time moderators out! monkaS"
			};
		}
		else if (context.append.userBadges.hasBroadcaster) {
			const emote = await context.getBestAvailableEmote(["PepeLaugh", "pepeLaugh", "LuL"], "😄");
			return {
				success: false,
				reply: `Why are you trying to vanish in your own channel? ${emote}`
			};
		}
		else if (context.append.userBadges.hasStaff) {
			return {
				success: false,
				reply: "I cannot time Twitch staff out! monkaS"
			};
		}
		else if (context.append.userBadges.hasAdmin) {
			return {
				success: false,
				reply: "I cannot time Twitch administrators out! monkaS"
			};
		}

		try {
			await context.platform.client.timeout(context.channel.Name, context.user.Name, 1, "Vanished");
		}
		catch {
			const emote = await context.getBestAvailableEmote(["LULW", "LuL", "LUL"], "😄");
			return {
				success: false,
				reply: `Could not time you out, because Twitch said nothing and left! ${emote}`
			};
		}

		return {
			reply: null
		};
	}),
	Dynamic_Description: null
};
