import { SubcommandCollection, type SubcommandDefinition } from "../../../classes/command.ts";

import ItemIdSubcommand from "./item-id.ts";
import KillcountSubcommand from "./killcount.ts";
import PlayerCountSubcommand from "./playercount.ts";
import PriceSubcommand from "./price.ts";
import StarsSubcommand from "./stars.ts";
import StatsSubcommand from "./stats.ts";
import StatusSubcommand from "./status.ts";
import TearsOfGuthixSubcommand from "./tears-of-guthix.ts";
import WikiSubcommand from "./wiki.ts";

const subcommands: SubcommandDefinition[] = [
	ItemIdSubcommand,
	KillcountSubcommand,
	PlayerCountSubcommand,
	PriceSubcommand,
	StarsSubcommand,
	StatsSubcommand,
	StatusSubcommand,
	TearsOfGuthixSubcommand,
	WikiSubcommand
];

export const OsrsSubcommands = new SubcommandCollection("osrs", subcommands);
