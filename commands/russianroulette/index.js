import { randomInt } from "../../utils/command-utils.js";
import definitions from "./definitions.json" with { type: "json" };
const { cannotTimeoutBadges, outcomes } = definitions;

export default {
	Name: "russianroulette",
	Aliases: ["rr"],
	Author: "supinic",
	Cooldown: 15000,
	Description: "Play the roulette. If you win, nothing happens; if you lose, you get timed out. You can add a number 1-600 (default: 1) which says how long you will be timed out, should you lose. You can use the command anywhere, but you can only get timed out in a channel where Supibot is a moderator.",
	Flags: ["mention","pipe"],
	Params: null,
	Whitelist_Response: null,
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

		const messageData = context.platformSpecificData;
		if (!messageData || !Array.isArray(messageData.badges)) {
			throw new sb.Error({
				message: "Assert error: No badges available on Twitch platform"
			});
		}

		let timeoutMode;
		const badges = messageData.badges.map(i => i.set_id);
		if (context.channel.Mode !== "Moderator") {
			timeoutMode = "nerf";
		}
		else if (badges.some(i => cannotTimeoutBadges.includes(i))) {
			timeoutMode = "blank";
		}
		else {
			timeoutMode = "real";
		}

		const platform = context.platform;
		const result = randomInt(1, 6);
		if (result === 1) {
			if (timeoutMode === "real") {
				try {
					await platform.timeout(
						context.channel,
						context.user,
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

			let outcome = core.Utils.randArray(outcomes[timeoutMode]);
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
