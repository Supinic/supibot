import { SubcommandCollection, type SubcommandDefinition } from "../../../classes/command.js";

import ConstructorStandingsSubcommand from "./constructor-standings.js";
import CopypastaSubcommand from "./copypasta.js";
import DriverStandingsSubcommand from "./driver-standings.js";
import FerrariSubcommand from "./ferrari.js";
import KimiSubcommand from "./kimi.js";
import RaceSubcommand from "./race.js";

const subcommands: SubcommandDefinition[] = [
	ConstructorStandingsSubcommand,
	CopypastaSubcommand,
	DriverStandingsSubcommand,
	FerrariSubcommand,
	KimiSubcommand,
	RaceSubcommand
];

export const FormulaOneSubcommands = new SubcommandCollection("f1", subcommands);
