import { SubcommandCollection, type SubcommandDefinition } from "../../../classes/command.js";

import AnimeDneSubcommand from "./anime.js";
import AutombileDneSubcommand from "./automobile.js";
import FuckedUpHomerDneSubcommand from "./fucked-up-homer.js";
import FursonaDneSubcommand from "./fursona.js";
import MpDneSubcommand from "./member-of-parliament.js";
import PersonDneSubcommand from "./person.js";
import WaifuDneSubcommand from "./waifu.js";
import WojakDneSubcommand from "./wojak.js";
import WordDneSubcommand from "./word.js";

const subcommands: SubcommandDefinition[] = [
	AnimeDneSubcommand,
	AutombileDneSubcommand,
	FuckedUpHomerDneSubcommand,
	FursonaDneSubcommand,
	MpDneSubcommand,
	PersonDneSubcommand,
	WaifuDneSubcommand,
	WojakDneSubcommand,
	WordDneSubcommand
];

export const DoesNotExistSubcommands = new SubcommandCollection("dne", subcommands);
