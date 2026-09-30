import { SubcommandCollection, type SubcommandDefinition } from "../../../classes/command.ts";

import EatSubcommand from "./eat.ts";
import DonateSubcommand from "./donate.ts";
import StatsSubcommand from "./stats.ts";
import TopSubcommand from "./top.ts";

const subcommands: SubcommandDefinition[] = [
	EatSubcommand,
	DonateSubcommand,
	StatsSubcommand,
	TopSubcommand
];

export const CookieSubcommands = new SubcommandCollection("cookie", subcommands);
