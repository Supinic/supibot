import { SubcommandCollection, type SubcommandDefinition } from "../../../classes/command.js";

import CheckSubcommand from "./check.js";
import ListSubcommand from "./list.js";
import RandomSubcommand from "./random.js";

const subcommands: SubcommandDefinition[] = [
	CheckSubcommand,
	ListSubcommand,
	RandomSubcommand
];

export const BadAppleSubcommands = new SubcommandCollection("badapple", subcommands);
