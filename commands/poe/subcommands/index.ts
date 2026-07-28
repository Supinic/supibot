import { SubcommandCollection, type SubcommandDefinition } from "../../../classes/command.js";
import LeagueSubcommand from "./league.js";
import RollSubcommand from "./roll.js";

const subcommands: SubcommandDefinition[] = [
	LeagueSubcommand,
	RollSubcommand
];

export const PathOfExileSubcommands = new SubcommandCollection("poe", subcommands);
