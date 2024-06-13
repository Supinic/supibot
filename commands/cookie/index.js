module.exports = {
	Name: "cookie",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Open a random fortune cookie wisdom. Only one allowed per day, no refunds! Subscribers to @Supinic get an extra golden cookie daily! Daily reset occurs at midnight UTC.",
	Flags: ["mention","pipe","rollback"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function cookie (context, type, receiver) {
		const Logic = require("./cookie-logic.js");
		const subcommand = Logic.parseSubcommand(type);

		/** @type {CookieData} */
		const cookieData = await context.user.getDataProperty("cookie") ?? Logic.getInitialStats();
		if (Logic.hasOutdatedDailyStats(cookieData)) {
			Logic.resetDailyStats(cookieData);
		}

		const { transaction } = context;
		const platform = sb.Platform.get("twitch");
		const hasDoubleCookieAccess = await platform.fetchUserCacheSubscription(context.user, "supinic");

		const options = { hasDoubleCookieAccess };
		if (subcommand === "eat") {
			const result = Logic.eatCookie(cookieData, options);
			if (!result.success) {
				return result;
			}

			const [cookieText] = await Promise.all([
				Logic.fetchRandomCookieText(),
				context.user.setDataProperty("cookie", cookieData, { transaction })
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

			const receiverHasDoubleCookieAccess = await platform.fetchUserCacheSubscription(receiverUserData);
			const receiverOptions = {
				hasDoubleCookieAccess: receiverHasDoubleCookieAccess
			};

			/** @type {CookieData} */
			const receiverCookieData = await receiverUserData.getDataProperty("cookie", { transaction }) ?? Logic.getInitialStats();
			if (Logic.hasOutdatedDailyStats(receiverCookieData)) {
				Logic.resetDailyStats(receiverCookieData);
			}

			const result = Logic.donateCookie(cookieData, receiverCookieData, options, receiverOptions);
			if (!result.success) {
				return result;
			}

			// noinspection JSCheckFunctionSignatures
			await Promise.all([
				context.user.setDataProperty("cookie", cookieData, { transaction }),
				receiverUserData.setDataProperty("cookie", receiverCookieData, { transaction })
			]);

			const emote = await context.getBestAvailableEmote(["Okayga", "supiniOkay", "FeelsOkayMan"], "😊");
			return {
				reply: `Successfully given your cookie for today to ${receiverUserData.Name} ${emote}`
			};
		}
		else if (subcommand === "stats") {
			let CookieStatistics;
			try {
				CookieStatistics = require("../statistics/types/cookie-count.js");
			}
			catch {
				return {
					success: false,
					reply: `The cookie statistics module is currently not available!`
				};
			}

			return await CookieStatistics.execute(context, "cookie", receiver);
		}
		else if (subcommand === "top") {
			return {
				reply: `Check out the cookie leaderboard here: https://supinic.com/bot/cookie/list`
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

		let statisticsArray = [];
		try {
			const CookieStatistics = require("../statistics/types/cookie-count.js");
			statisticsArray = [
				`<code>${prefix}cookie stats</code>`,
				`<code>${prefix}cookie statistics</code>`,
				`<code>${prefix}cookie stats total</code>`,
				`<code>${prefix}cookie stats (user)</code>`,
				CookieStatistics.description
			];
		}
		catch {
			return {
				success: false,
				reply: `The cookie statistics module is currently not available!`
			};
		}

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
			"Cookies can also be donated to other users, if you so wish.",
			"",

			`<code>${prefix}cookie top</code>`,
			`<code>${prefix}cookie leaderboard</code>`,
			`Posts the link to the <a href="/bot/cookie/list">cookie leaderboard</a> in the chat.`,
			"",

			`<code>${prefix}cookie top</code>`,
			`<code>${prefix}cookie leaderboard</code>`,
			`Posts the link to the <a href="/bot/cookie/list">cookie leaderboard</a> in the chat.`,
			"",

			...statisticsArray
		];
	})
};
