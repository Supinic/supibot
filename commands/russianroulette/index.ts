import * as z from "zod";
import { SupiError } from "supi-core";
import { randomInt } from "../../utils/command-utils.js";
import { declare } from "../../classes/command.js";
import rawDefinitions from "./definitions.json" with { type: "json" };
import type { TwitchPlatform } from "../../platforms/twitch.js";

const definitionsSchema = z.object({
	upperLimit: z.int().min(1).max(86400),
	cannotTimeoutBadges: z.array(z.string()),
	outcomes: z.object({
		blank: z.array(z.string()),
		nerf: z.array(z.string()),
		real: z.array(z.string())
	})
});

const definitions = definitionsSchema.parse(rawDefinitions);
const { cannotTimeoutBadges, outcomes, upperLimit } = definitions;

export default declare({
	Name: "russianroulette",
	Aliases: ["rr"],
	Author: "supinic",
	Cooldown: 15000,
	Description: "Play the roulette. If you win, nothing happens; if you lose, you get timed out. You can add a number 1-600 (default: 1) which says how long you will be timed out, should you lose. You can use the command anywhere, but you can only get timed out in a channel where Supibot is a moderator.",
	Flags: ["mention","pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function russianRoulette (context, input) {
		if (context.channel === null) {
			return {
				success: false,
				reply: "You cannot play the roulette in private messages!"
			};
		}
		else if (context.platform.Name !== "twitch") {
			return {
				success: false,
				reply: "You cannot play the roulette outside of Twitch!"
			};
		}

		const timeoutLength = (input) ? Number(input) : 1;
		if (timeoutLength < 1 || !Number.isFinite(timeoutLength) || Math.round(timeoutLength) !== timeoutLength) {
			return {
				success: false,
				reply: `Invalid timeout length provided! Use a number between 1 and ${upperLimit}, or nothing for 1.`,
				cooldown: 2500
			};
		}
		else if (timeoutLength > upperLimit) {
			return {
				success: false,
				reply: "Maximum timeout length (600 seconds) exceeded!",
				cooldown: 2500
			};
		}

		// @todo: Proper type security for messageData appearing as TwitchAppendData in TwitchPlatform
		const messageData = context.platformSpecificData;
		if (!messageData || !("badges" in messageData) || !Array.isArray(messageData.badges)) {
			throw new SupiError({
				message: "Assert error: No badges available on Twitch platform"
			});
		}

		let timeoutMode: "nerf" | "blank" | "real";
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

		// @todo remove typecast when platform is discriminated by name
		const platform = context.platform as TwitchPlatform;
		const result = randomInt(1, 6);
		if (result !== 1) {
			return {
				success: true,
				reply: "Click! You are safe."
			};
		}

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
				const emote = await context.getBestAvailableEmote(["LULE", "LULW", "LuL", "LUL"], "😄");
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
			success: true,
			reply: outcome
		};
	}),
	Dynamic_Description: null
});
