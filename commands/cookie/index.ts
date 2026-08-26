import { SupiDate } from "supi-core";
import { CookieSubcommands } from "./subcommands/index.js";
import { declare, type SubcommandDefinition } from "../../classes/command.js";

export type CookieSubcommandDefinition = SubcommandDefinition<typeof cookieCommandDefinition>;

const cookieCommandDefinition = declare({
	Name: "cookie",
	Aliases: null,
	Cooldown: 10000,
	Description: "Open a random fortune cookie wisdom. Only one allowed per day, no refunds! Subscribers to @Supinic get an extra golden cookie daily! Daily reset occurs at midnight UTC.",
	Flags: ["mention", "pipe", "rollback"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function cookie (context, subcommandName, receiver) {
		const subcommand = (subcommandName)
			? subcommands.find(i => i.name === subcommandName || i.aliases?.includes(subcommandName))
			: defaultSubcommand;

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
		const utcMidnightToday = SupiDate.getTodayUTC();
		const nextUtcMidnightDate = new SupiDate(utcMidnightToday).addHours(24);
		const delta = core.Utils.timeDelta(nextUtcMidnightDate);

		return [
			"Fetches a daily fortune cookie and read its wisdom!",
			`Only available once per day, and resets at midnight UTC - which, from now, is ${delta}`,
			"",

			...subcommandDescriptions
		];
	})
});

export default cookieCommandDefinition;
