import type { SubcommandDefinition } from "../../../classes/command.js";
export interface DefaultedSubcommand extends SubcommandDefinition {
	description: string[]; // @todo remove `string` in standard subcommands type
	default: boolean;
}

import ItemIdSubcommand from "./item-id.js";
import KillcountSubcommand from "./killcount.js";
import PriceSubcommand from "./price.js";
import StarsSubcommand from "./stars.js";
import StatsSubcommand from "./stats.js";
import StatusSubcommand from "./status.js";
import TearsOfGuthixSubcommand from "./tears-of-guthix.js";
import WikiSubcommand from "./wiki.js";

export const subcommands: DefaultedSubcommand[] = [
	ItemIdSubcommand,
	KillcountSubcommand,
	PriceSubcommand,
	StarsSubcommand,
	StatsSubcommand,
	StatusSubcommand,
	TearsOfGuthixSubcommand,
	WikiSubcommand
];
