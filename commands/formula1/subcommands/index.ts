import type { SubcommandDefinition } from "../../../classes/command.js";
type DescribedSubcommandDefinition = SubcommandDefinition & {
	description: string[]; // @todo remove `string` in standard subcommands type
}

import ConstructorStandingsSubcommand from "./constructor-standings.js";
import CopypastaSubcommand from "./copypasta.js";
import DriverStandingsSubcommand from "./driver-standings.js";
import KimiSubcommand from "./kimi.js";
import RaceSubcommand from "./race.js";

export const subcommands: DescribedSubcommandDefinition[] = [
	ConstructorStandingsSubcommand,
	CopypastaSubcommand,
	DriverStandingsSubcommand,
	KimiSubcommand,
	RaceSubcommand
];
