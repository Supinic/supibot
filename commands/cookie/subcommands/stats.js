import { UserCookieCountStatistic } from "../../statistics/definitions/cookies.js";

export default {
	name: "stats",
	aliases: ["statistics"],
	description: [
		`<code>$cookie stats</code>`,
		`<code>$cookie statistics</code>`,
		"Checks the total amount of cookies you have eaten, plus a quick \"karma check\" on how many you gifted vs. received.",
		"",

		`<code>$cookie statsc (user)</code>`,
		`<code>$cookie stats (user)</code>`,
		"Checks the cookies eaten for someone else, with the same karma check as above."
	],
	execute: async (context, cookieData, subcommandName, user) => await UserCookieCountStatistic.execute(context, "cookie", user)
};
