import { SubcommandCollection, type SubcommandDefinition } from "../../../classes/command.ts";

import AnimeDneSubcommand from "./anime.ts";
import AutombileDneSubcommand from "./automobile.ts";
import FuckedUpHomerDneSubcommand from "./fucked-up-homer.ts";
import FursonaDneSubcommand from "./fursona.ts";
import MpDneSubcommand from "./member-of-parliament.ts";
import PersonDneSubcommand from "./person.ts";
import WaifuDneSubcommand from "./waifu.ts";
import WojakDneSubcommand from "./wojak.ts";
import WordDneSubcommand from "./word.ts";

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
