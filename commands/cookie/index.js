const Logic = require("./cookie-logic");
module.exports = {
	Name: "cookie",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Open a random fortune cookie wisdom. Watch out - only one allowed per day, and no refunds! Daily reset occurs at midnight UTC.",
	Flags: ["mention","pipe","rollback"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function cookie (context, type, receiver) {
		const Logic = require("./cookie-logic.js");
		const subcommand = Logic.parseSubcommand(type);

		/** @type {CookieData} */
		const cookieData = await context.user.getDataProperty("cookie") ?? Logic.getInitialStats();
		if (Logic.hasOutdatedDailyStats(cookieData)) {
			Logic.resetDailyStats(cookieData);
		}

		const subscriberList = await sb.Cache.getByPrefix("twitch-subscriber-list-supinic");
		let hasDoubleCookieAccess = false;
		if (Array.isArray(subscriberList)) {
			hasDoubleCookieAccess = subscriberList.some(i => i.user_id === context.user.Twitch_ID);
		}

		const options = { hasDoubleCookieAccess };
		if (subcommand === "eat") {
			const result = Logic.eatCookie(cookieData, options);
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
			if (!receiver) {
				return {
					success: false,
					reply: `No user provided! Who do you want to ${type} the cookie to?`
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
					reply: (!Logic.canEatDailyCookie(cookieData) && !Logic.canEatReceivedCookie(cookieData))
						? "You already ate or donated your daily cookie today, so you can't donate it, not even to yourself!"
						: "Okay...! So you passed the cookie from one hand to the other... Now what?"
				};
			}

			let receiverHasDoubleCookieAccess = false;
			if (Array.isArray(subscriberList)) {
				receiverHasDoubleCookieAccess = subscriberList.some(i => i.user_id === receiverUserData.Twitch_ID);
			}

			const receiverOptions = {
				hasDoubleCookieAccess: receiverHasDoubleCookieAccess
			};

			/** @type {CookieData} */
			const receiverCookieData = await receiverUserData.getDataProperty("cookie") ?? Logic.getInitialStats();
			if (Logic.hasOutdatedDailyStats(receiverCookieData)) {
				Logic.resetDailyStats(receiverCookieData);
			}

			const result = Logic.donateCookie(cookieData, receiverCookieData, options, receiverOptions);
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
		else if (subcommand === "stats") {
			return {
				success: false,
				reply: `You should use "$stats cookie" instead!`
			};
		}
		else {
			return {
				success: false,
				reply: `Unrecognized subcommand! Use one of: ${Logic.getValidTypeNames()}; or just use $cookie with no text behind.`
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
