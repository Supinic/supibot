const CookieLogic = require("../cookie-logic.js");

module.exports = {
	name: "donate",
	aliases: ["gift", "give"],
	description: [
		`<code>$cookie donate (user)</code>`,
		`<code>$cookie gift (user)</code>`,
		`<code>$cookie give (user)</code>`,
		"Gives your daily cookie to another other user, if you so wish.",
		"Cookies received in this fashion cannot be passed to someone else."
	],
	execute: async (context, cookieData, subcommandName, receiver) => {
		if (!receiver) {
			return {
				success: false,
				reply: `No user provided! Who do you want to ${subcommandName} the cookie to?`
			};
		}

		const receiverUserData = await sb.User.get(receiver);
		if (!receiverUserData) {
			return {
				success: false,
				reply: `I haven't seen that user before, so you can't donate cookies to them!`
			};
		}
		else if (receiverUserData.Name === context.platform.Self_Name) {
			return {
				reply: "I appreciate the gesture, but thanks, I don't eat sweets :)"
			};
		}
		else if (context.user === receiverUserData) {
			return {
				reply: (!CookieLogic.canEatDailyCookie(cookieData) && !CookieLogic.canEatReceivedCookie(cookieData))
					? "You already ate or donated your daily cookie today, so you can't donate it, not even to yourself!"
					: "Okay...! So you passed the cookie from one hand to the other... Now what?"
			};
		}

		const platform = sb.Platform.get("twitch");
		const receiverHasDoubleCookieAccess = await platform.fetchUserAdminSubscription(receiverUserData);
		const receiverOptions = {
			hasDoubleCookieAccess: receiverHasDoubleCookieAccess
		};

		const { transaction } = context;
		/** @type {CookieData} */
		const receiverCookieData = await receiverUserData.getDataProperty("cookie", { transaction }) ?? CookieLogic.getInitialStats();
		if (CookieLogic.hasOutdatedDailyStats(receiverCookieData)) {
			CookieLogic.resetDailyStats(receiverCookieData);
		}

		const hasDoubleCookieAccess = await platform.fetchUserAdminSubscription(context.user);
		const result = CookieLogic.donateCookie(cookieData, receiverCookieData, { hasDoubleCookieAccess }, receiverOptions);
		if (!result.success) {
			return result;
		}

		await Promise.all([
			context.user.setDataProperty("cookie", cookieData, { transaction }),
			receiverUserData.setDataProperty("cookie", receiverCookieData, { transaction })
		]);

		const emote = await context.getBestAvailableEmote(["Okayga", "supiniOkay", "FeelsOkayMan"], "😊");
		return {
			reply: `Successfully given your cookie for today to ${receiverUserData.Name} ${emote}`
		};
	}
};
