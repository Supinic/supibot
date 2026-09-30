import { SubcommandCollection, type SubcommandDefinition } from "../../../classes/command.ts";

import CheckSubcommand from "./check.ts";
import ListSubcommand from "./list.ts";
import RandomSubcommand from "./random.ts";

const subcommands: SubcommandDefinition[] = [
	CheckSubcommand,
	ListSubcommand,
	RandomSubcommand
];

export const BadAppleSubcommands = new SubcommandCollection("badapple", subcommands);
