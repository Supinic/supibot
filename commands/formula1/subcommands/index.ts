import { SubcommandCollection, type SubcommandDefinition } from "../../../classes/command.ts";

import ConstructorStandingsSubcommand from "./constructor-standings.ts";
import CopypastaSubcommand from "./copypasta.ts";
import DriverStandingsSubcommand from "./driver-standings.ts";
import FerrariSubcommand from "./ferrari.ts";
import KimiSubcommand from "./kimi.ts";
import RaceSubcommand from "./race.ts";

const subcommands: SubcommandDefinition[] = [
	ConstructorStandingsSubcommand,
	CopypastaSubcommand,
	DriverStandingsSubcommand,
	FerrariSubcommand,
	KimiSubcommand,
	RaceSubcommand
];

export const FormulaOneSubcommands = new SubcommandCollection("f1", subcommands);
