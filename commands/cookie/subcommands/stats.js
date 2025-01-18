const CookieStatistics = require("../../statistics/types/cookie-count.js");

module.exports = {
	name: "stats",
	aliases: ["statistics"],
	description: [
		`<code>$cookie stats</code>`,
		`<code>$cookie statistics</code>`,
		CookieStatistics.description
	],
	execute: async (context, cookieData, subcommandName, user) => await CookieStatistics.execute(context, "cookie", user)
};
