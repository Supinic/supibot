const { subcommands } = require("./subcommands/index.js");
const subcommandDescriptions = [];
for (const subcommand of subcommands) {
	subcommandDescriptions.push(
		...subcommand.description,
		""
	);
}

const CookieLogic = require("./cookie-logic");

const defaultSubcommand = subcommands.find(i => i.flags?.defaultOnEmptyInput);
const subcommandNames = subcommands.map(i => i.name).join(", ");

export default {
	Name: "cookie",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Open a random fortune cookie wisdom. Only one allowed per day, no refunds! Subscribers to @Supinic get an extra golden cookie daily! Daily reset occurs at midnight UTC.",
	Flags: ["mention", "pipe", "rollback"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function cookie (context, subcommandName, receiver) {
		const subcommand = (subcommandName)
			? subcommands.find(i => i.name === subcommand || i.aliases?.includes(subcommand))
			: defaultSubcommand;

		const cookieData = await context.user.getDataProperty("cookie") ?? CookieLogic.getInitialStats();
		if (CookieLogic.hasOutdatedDailyStats(cookieData)) {
			CookieLogic.resetDailyStats(cookieData);
		}

		if (subcommand) {
			return await subcommand.execute(context, cookieData, subcommandName, receiver);
		}
		else {
			return {
				success: false,
				reply: `Unrecognized subcommand! Use one of: ${subcommandNames}; or just use $cookie with no text behind.`
			};
		}
	}),
	Dynamic_Description: (async function (prefix) {
		const utcMidnightToday = sb.Date.getTodayUTC();
		const nextUtcMidnightDate = new sb.Date(utcMidnightToday).addHours(24);
		const delta = sb.Utils.timeDelta(nextUtcMidnightDate);

		return [
			"Fetches a daily fortune cookie and read its wisdom!",
			`Only available once per day, and resets at midnight UTC - which, from now, is ${delta}`,
			"",

			...subcommandDescriptions
		];
	})
};
