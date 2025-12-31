import { SupiDate } from "supi-core";

import type { CheckSubcommandDefinition } from "../index.js";
import CookieLogic from "../../cookie/cookie-logic.js";

export default {
	name: "cookie",
	title: "Cookie status",
	default: false,
	aliases: [],
	description: ["Checks if someone (or you, if not provided) has their fortune cookie available for today."],
	execute: async (context, identifier) => {
		const targetUser = (identifier)
			? await sb.User.get(identifier, true)
			: context.user;

		if (!targetUser) {
			return {
				success: false,
				reply: "Provided user does not exist!"
			};
		}
		else if (targetUser.Name === context.platform.selfName) {
			return {
				reply: "No peeking! 🍪🤖🛡 👀"
			};
		}

		const pronoun = (context.user.ID === targetUser.ID) ? "You" : "They";
		const posPronoun = (context.user.ID === targetUser.ID) ? "your" : "their";

		const userCookieData = await targetUser.getDataProperty("cookie");
		if (!userCookieData) {
			return {
				reply: `${pronoun} have never eaten a cookie before.`
			};
		}

		if (CookieLogic.hasOutdatedDailyStats(userCookieData)) {
			CookieLogic.resetDailyStats(userCookieData);
			await targetUser.setDataProperty("cookie", userCookieData);
		}

		const platform = sb.Platform.getAsserted("twitch");
		const hasDoubleCookieAccess = await platform.fetchUserAdminSubscription(targetUser);

		let string;
		if (CookieLogic.canEatReceivedCookie(userCookieData)) {
			string = `${pronoun} have a donated cookie waiting to be eaten.`;
		}
		else if (CookieLogic.canEatDailyCookie(userCookieData, { hasDoubleCookieAccess })) {
			const cookieType = CookieLogic.determineAvailableDailyCookieType(userCookieData, {
				hasDoubleCookieAccess
			});

			string = `${pronoun} have a ${cookieType} cookie waiting to be eaten.`;
		}
		else if (CookieLogic.hasDonatedDailyCookie(userCookieData)) {
			string = `${pronoun} have already donated ${posPronoun} daily cookie today.`;
		}
		else {
			string = `${pronoun} have already eaten ${posPronoun} daily cookie today.`;
		}

		const nextMidnight = new SupiDate(SupiDate.getTodayUTC()).addHours(24);
		const delta = core.Utils.timeDelta(nextMidnight);
		return {
			reply: `${string} Next reset of daily cookies will occur in ${delta}.`
		};
	}
} satisfies CheckSubcommandDefinition;
