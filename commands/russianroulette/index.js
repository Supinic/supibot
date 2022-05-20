module.exports = {
	Name: "russianroulette",
	Aliases: ["rr"],
	Author: "supinic",
	Cooldown: 15000,
	Description: "Play the roulette. If you win, nothing happens; if you lose, you get timed out. You can add a number 1-600 (default: 1) which says how long you will be timed out, should you lose. Only works in channels where Supibot is moderator.",
	Flags: ["mention","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (() => ({
		cannotTimeoutBadges: ["hasModerator", "hasBroadcaster", "hasStaff", "hasAdmin"],
		outcomes: {
			blank: [
				"Bang! The timeout bullet was a blank. It's not very effective.",
				"Bang! The timeout bullet hits the ceiling. I'm not allowed to time you out monkaS",
				"Bang! You masterfully dodge the bullet. Seems like your agility level is too high.",
				"Bang! You stop the bullet in front of the palm of your hand. How? Are you The One?"
			],
			nerf: [
				"Poof! You got hit in the face by a nerf pellet. It's not very effective.",
				"Bonk! You got hit on the head with an inflatable hammer. It doesn't do anything.",
				"Woosh! A splash of water gushes from the gun. Best I can do, sorry.",
				"Pop! You got \"hit\" by my finger guns 👉👉. Nothing happens."
			],
			real: [
				"Bang! It's over.",
				"Bang! See you in a bit.",
				"Bang! Sayonara.",
				"Bang! Time for a bit of a break."
			]
		}
	})),
	Code: (async function russianRoulette (context, timeoutLength) {
		if (context.channel === null) {
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

		const { userBadges } = context.append;

		let timeoutMode;
		if (context.channel.Mode !== "Moderator") {
			timeoutMode = "nerf";
		}
		else if (this.staticData.cannotTimeoutBadges.some(i => userBadges[i] === true)) {
			timeoutMode = "blank";
		}
		else {
			timeoutMode = "real";
		}

		const result = sb.Utils.random(1, 6);
		if (result === 1) {
			if (timeoutMode === "real") {
				try {
					await context.platform.client.timeout(
						context.channel.Name,
						context.user.Name,
						timeoutLength,
						"Lost the roulette"
					);
				}
				catch {
					const emote = await context.getBestAvailableEmote(["LULW", "LuL", "LUL"], "😄");
					return {
						success: false,
						reply: `Could not time you out, because Twitch said nothing and left! ${emote}`
					};
				}
			}

			let outcome = sb.Utils.randArray(this.staticData.outcomes[timeoutMode]);
			if (timeoutMode === "nerf") {
				outcome += ` (can't time out anyone if I'm not a moderator)`;
			}
			else if (timeoutMode === "blank") {
				outcome += ` (can't time you out)`;
			}

			return {
				reply: outcome
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
