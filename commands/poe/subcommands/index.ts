import { SubcommandCollection, type SubcommandDefinition } from "../../../classes/command.ts";
import LeagueSubcommand from "./league.ts";
import RollSubcommand from "./roll.ts";

const subcommands: SubcommandDefinition[] = [
	LeagueSubcommand,
	RollSubcommand
];

export const PathOfExileSubcommands = new SubcommandCollection("poe", subcommands);
