module.exports = {
	Name: "russianroulette",
	Aliases: ["rr"],
	Author: "supinic",
	Cooldown: 15000,
	Description: "Play the roulette. If you win, nothing happens; if you lose, you get timed out. You can add a number 1-600 (default: 1) which says how long you will be timed out, should you lose. Only works in channels where Supibot is moderator.",
	Flags: ["mention","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function russianRoulette (context, timeoutLength) {
		if (context.channel === null || context.channel.Mode !== "Moderator") {
			return {
				success: false,
				reply: "You cannot play the roulette in here!"
			};
		}
		else if (context.platform.Name !== "twitch") {
			return {
				success: false,
				reply: "You cannot play the roulette outside of Twitch!"
			};
		}
		else if (context.append.userBadges.hasModerator) {
			return {
				success: false,
				reply: "Moderators can't be timed out, cheaters!"
			};
		}
		else if (context.append.userBadges.hasBroadcaster) {
			return {
				success: false,
				reply: "Broadcasters can't be timed out, cheaters!"
			};
		}
		else if (context.append.userBadges.hasStaff) {
			return {
				success: false,
				reply: "Staff can't be timed out, cheaters!"
			};
		}
		else if (context.append.userBadges.hasAdmin) {
			return {
				success: false,
				reply: "Admins can't be timed out, cheaters! monkaS"
			};
		}
	
		timeoutLength = (timeoutLength) ? Number(timeoutLength) : 1;

		if (timeoutLength < 1 || !Number.isFinite(timeoutLength) || Math.round(timeoutLength) !== timeoutLength) {
			return {
				success: false,
				reply: "Invalid timeout length provided!",
				cooldown: 2500
			};
		}
		else if (timeoutLength > 600) {
			return {
				success: false,
				reply: "Maximum timeout length (600 seconds) exceeded!",
				cooldown: 2500
			};
		}
	
		const result = sb.Utils.random(1, 6);
		if (result === 1) {
			await context.platform.client.timeout(
				context.channel.Name,
				context.user.Name,
				timeoutLength,
				"Lost the roulette"
			);
	
			return {
				reply: "Bang! It's over."
			};
		}
		else {
			return {
				reply: "Click! You are safe."
			};
		}
	}),
	Dynamic_Description: null
};