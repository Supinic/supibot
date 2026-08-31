import { SupiDate } from "supi-core";
import type { CheckSubcommandDefinition } from "../index.js";
import {
	canEatDailyCookie,
	canEatReceivedCookie,
	determineAvailableDailyCookieType,
	hasDonatedDailyCookie,
	hasOutdatedDailyCookieStats,
	resetDailyCookieStats
} from "../../cookie/cookie-logic.js";

export default {
	name: "cookie",
	title: "Cookie status",
	aliases: [],
	getDescription: (prefix) => [
		`Checks the availability of fortune cookies as used in the <a href="/bot/command/detail/cookie">${prefix}cookie</a> command.`,
		"",

		`<code>${prefix}check cookie</code>`,
		`Checks if you have a fortune cookie ready for today.`,
		"",

		`<code>${prefix}check cookie (username)</code>`,
		`Checks if someone else has a fortune cookie ready for today.`
	],
	execute: async (context, type, identifier) => {
		const targetUser = (identifier) ? await sb.User.get(identifier, true) : context.user;
		if (!targetUser) {
			return {
				success: false,
				reply: "Provided user does not exist!"
			};
		}
		else if (targetUser.Name === context.platform.selfName) {
			return {
				success: true,
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

		if (hasOutdatedDailyCookieStats(userCookieData)) {
			resetDailyCookieStats(userCookieData);
			await targetUser.setDataProperty("cookie", userCookieData);
		}

		const platform = sb.Platform.getAsserted("twitch");
		const hasDoubleCookieAccess = await platform.fetchUserAdminSubscription(targetUser);

		let string;
		if (canEatReceivedCookie(userCookieData)) {
			string = `${pronoun} have a donated cookie waiting to be eaten.`;
		}
		else if (canEatDailyCookie(userCookieData, { hasDoubleCookieAccess })) {
			const cookieType = determineAvailableDailyCookieType(userCookieData, { hasDoubleCookieAccess });
			string = `${pronoun} have a ${cookieType} cookie waiting to be eaten.`;
		}
		else if (hasDonatedDailyCookie(userCookieData)) {
			string = `${pronoun} have already donated ${posPronoun} daily cookie today.`;
		}
		else {
			string = `${pronoun} have already eaten ${posPronoun} daily cookie today.`;
		}

		const nextMidnight = new SupiDate(SupiDate.getTodayUTC()).addHours(24);
		const delta = core.Utils.timeDelta(nextMidnight);
		return {
			success: true,
			reply: `${string} Next reset of daily cookies will occur in ${delta}.`
		};
	}
} satisfies CheckSubcommandDefinition;
