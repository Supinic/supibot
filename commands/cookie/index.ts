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
	Code: (async function cookie (context, type, ...args) {
		const subcommand = (type)
			? CookieSubcommands.get(type)
			: CookieSubcommands.default;

		if (!subcommand) {
			return {
				success: false,
				reply: `Unrecognized subcommand! Use one of: ${CookieSubcommands.names.join(", ")}; or just use $cookie with no text behind.`
			};
		}

		return await subcommand.execute.call(this, context, type, ...args);
	}),
	Dynamic_Description: async () => {
		const utcMidnightToday = SupiDate.getTodayUTC();
		const nextUtcMidnightDate = new SupiDate(utcMidnightToday).addHours(24);
		const delta = core.Utils.timeDelta(nextUtcMidnightDate);

		const subcommandDescriptions = await CookieSubcommands.createDescription();
		return [
			"Fetches a daily fortune cookie and read its wisdom!",
			`Only available once per day, and resets at midnight UTC - which, from now, is ${delta}`,
			"",

			...subcommandDescriptions
		];
	}
});

export default cookieCommandDefinition;
