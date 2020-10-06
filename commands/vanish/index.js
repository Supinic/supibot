module.exports = {
	Name: "vanish",
	Aliases: null,
	Author: "supinic",
	Cooldown: 60000,
	Description: "Times out the user for 1 second. Only works if Supibot is a Twitch moderator.",
	Flags: ["skip-banphrase"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function vanish (context) {
		if (context.channel === null || context.channel.Mode !== "Moderator") {
			return { reply: "You cannot vanish here!" };
		}
		else if (context.platform.Name !== "twitch") {
			return { reply: "You cannot vanish outside of Twitch!" };
		}
		else if (context.append.userBadges.hasModerator) {
			return { reply: "I cannot time moderators out! monkaS" };
		}
		else if (context.append.userBadges.hasGlobalMod) {
			return { reply: "I cannot time global moderators out! monkaS" };
		}
		else if (context.append.userBadges.hasBroadcaster) {
			return { reply: "Why are you trying to vanish in your own channel? 4Head" };
		}
		else if (context.append.userBadges.hasStaff) {
			return { reply: "I cannot time Twitch staff out! monkaS" };
		}
		else if (context.append.userBadges.hasAdmin) {
			return { reply: "I cannot time Twitch administrators out! monkaS" };
		}
	
		context.platform.client.privmsg(context.channel.Name, "/timeout " + context.user.Name + " 1 vanished");
	}),
	Dynamic_Description: null
};