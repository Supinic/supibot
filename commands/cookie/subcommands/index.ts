import { SubcommandCollection, type SubcommandDefinition } from "../../../classes/command.js";

import EatSubcommand from "./eat.js";
import DonateSubcommand from "./donate.js";
import StatsSubcommand from "./stats.js";
import TopSubcommand from "./top.js";

const subcommands: SubcommandDefinition[] = [
	EatSubcommand,
	DonateSubcommand,
	StatsSubcommand,
	TopSubcommand
];

export const CookieSubcommands = new SubcommandCollection("cookie", subcommands);
