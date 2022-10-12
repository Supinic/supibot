module.exports = {
	Name: "cookie",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Open a random fortune cookie wisdom. Watch out - only one allowed per day, and no refunds! Daily reset occurs at midnight UTC.",
	Flags: ["mention","pipe","rollback","whitelist"],
	Params: null,
	Whitelist_Response: "The $cookie command is currently under reconstruction! Please try again later.",
	Static_Data: null,
	Code: (async function cookie (context, type, receiver) {
		const Logic = require("./cookie-logic.js");
		const subcommand = Logic.parseSubcommand(type);

		/** @type {CookieData} */
		const cookieData = await context.user.getDataProperty("cookie") ?? Logic.getInitialStats();
		if (Logic.hasOutdatedDailyStats(cookieData)) {
			Logic.resetDailyStats(cookieData);
		}

		if (subcommand === "eat") {
			const result = Logic.eatCookie(cookieData);
			if (!result.success) {
				return result;
			}

			const [cookieText] = await Promise.all([
				Logic.fetchRandomCookieText(),
				context.user.setDataProperty("cookie", cookieData)
			]);

			const string = `Your ${result.type} cookie:`;
			return {
				reply: `${string} ${cookieText}`
			};
		}
		else if (subcommand === "donate") {
			const receiverUserData = await sb.User.get(receiver);
			if (!receiverUserData) {
				return {
					success: false,
					reply: `I haven't seen that user before, so you can't gift cookies to them!`
				};
			}
			else if (receiverUserData.Name === context.platform.Self_Name) {
				return {
					reply: "I appreciate the gesture, but thanks, I don't eat sweets :)"
				};
			}
			else if (context.user === receiverUserData) {
				return {
					reply: (!Logic.canEatDailyCookie(cookieData) && !Logic.canEatReceivedCookie(cookieData))
						? "You already ate or donated your daily cookie today, so you can't donate it, not even to yourself!"
						: "Okay...! So you passed the cookie from one hand to the other... Now what?"
				};
			}

			/** @type {CookieData} */
			const receiverCookieData = await receiverUserData.getDataProperty("cookie") ?? Logic.getInitialStats();
			const result = Logic.donateCookie(cookieData, receiverCookieData);
			if (!result.success) {
				return result;
			}

			// noinspection JSCheckFunctionSignatures
			await Promise.all([
				context.user.setDataProperty("cookie", cookieData),
				receiverUserData.setDataProperty("cookie", receiverCookieData)
			]);

			const emote = await context.getBestAvailableEmote(["Okayga", "supiniOkay", "FeelsOkayMan"], "😊");
			return {
				reply: `Successfully given your cookie for today to ${receiverUserData.Name} ${emote}`
			};
		}
		else {
			return {
				success: false,
				reply: `Unrecognized subcommand! Use one of: ${Logic.getValidTypeNames()}`
			};
		}
	}),
	Dynamic_Description: (async function (prefix) {
		const utcMidnightToday = sb.Date.getTodayUTC();
		const nextUtcMidnightDate = new sb.Date(utcMidnightToday).addHours(24);
		const delta = sb.Utils.timeDelta(nextUtcMidnightDate);

		return [
			"Fetch a daily fortune cookie and read its wisdom!",
			`Only available once per day, and resets at midnight UTC - which from now, is ${delta}`,
			"",

			`<code>${prefix}cookie</code>`,
			`<code>${prefix}cookie eat</code>`,
			"Opens up, eats and reads a daily fortune cookie.",
			"",

			`<code>${prefix}cookie gift (user)</code>`,
			`<code>${prefix}cookie give (user)</code>`,
			`<code>${prefix}cookie donate (user)</code>`,
			"Cookies can also be donated to other users, if you so wish."
		];
	})
};
