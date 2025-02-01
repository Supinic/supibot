import CookieStatistics from "../../statistics/definitions/cookie-count.js";

export default {
	name: "stats",
	aliases: ["statistics"],
	description: [
		`<code>$cookie stats</code>`,
		`<code>$cookie statistics</code>`,
		CookieStatistics.description
	],
	execute: async (context, cookieData, subcommandName, user) => await CookieStatistics.execute(context, "cookie", user)
};
