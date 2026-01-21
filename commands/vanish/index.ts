import { SupiError } from "supi-core";
import { declare } from "../../classes/command.js";

export default declare({
	Name: "vanish",
	Aliases: null,
	Cooldown: 60000,
	Description: "Twitch only: times the user out for 1 second. Only works if Supibot is a Twitch moderator.",
	Flags: ["skip-banphrase"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function vanish (context) {
		if (context.platform.Name !== "twitch") {
			return {
				success: false,
				reply: "You cannot vanish outside of Twitch!"
			};
		}
		else if (context.channel === null) {
			return {
				success: false,
				reply: "Vanishing is impossible in private messages!"
			};
		}
		else if (context.channel.Mode !== "Moderator") {
			return {
				success: false,
				reply: "I cannot make you vanish here, as I'm not a moderator!"
			};
		}

		const twitch = sb.Platform.getAsserted("twitch");
		const messageData = context.platformSpecificData;

		// @todo: Proper type security for messageData appearing as TwitchAppendData in TwitchPlatform
		if (!messageData || !("badges" in messageData) || !Array.isArray(messageData.badges)) {
			throw new SupiError({
				message: "Assert error: No badges available on Twitch platform"
			});
		}

		const badges = new Set(messageData.badges.map(i => i.set_id));
		if (badges.has("moderator")) {
			return {
				success: false,
				reply: "I cannot time moderators out! monkaS"
			};
		}
		else if (badges.has("broadcaster")) {
			const emote = await context.getBestAvailableEmote(["PepeLaugh", "pepeLaugh", "LuL"], "😄");
			return {
				success: false,
				reply: `Why are you trying to vanish in your own channel? ${emote}`
			};
		}
		else if (badges.has("staff")) {
			return {
				success: false,
				reply: "I cannot time Twitch staff out! monkaS"
			};
		}

		try {
			await twitch.timeout(context.channel, context.user, 1, "Vanished");
		}
		catch {
			const emote = await context.getBestAvailableEmote(["LULE", "LULW", "LuL", "LUL"], "😄");
			return {
				success: false,
				reply: `Could not time you out, because Twitch said nothing and left! ${emote}`
			};
		}

		return {
			success: true,
			reply: null
		};
	}),
	Dynamic_Description: null
});
