import { SubcommandCollection, type SubcommandDefinition } from "../../../classes/command.js";

import ItemIdSubcommand from "./item-id.js";
import KillcountSubcommand from "./killcount.js";
import PriceSubcommand from "./price.js";
import StarsSubcommand from "./stars.js";
import StatsSubcommand from "./stats.js";
import StatusSubcommand from "./status.js";
import TearsOfGuthixSubcommand from "./tears-of-guthix.js";
import WikiSubcommand from "./wiki.js";

const subcommands: SubcommandDefinition[] = [
	ItemIdSubcommand,
	KillcountSubcommand,
	PriceSubcommand,
	StarsSubcommand,
	StatsSubcommand,
	StatusSubcommand,
	TearsOfGuthixSubcommand,
	WikiSubcommand
];

export const OsrsSubcommands = new SubcommandCollection("osrs", subcommands);
