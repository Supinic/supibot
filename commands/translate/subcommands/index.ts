import { SubcommandCollection, type SubcommandDefinition } from "../../../classes/command.ts";

import DeeplTranslateSubcommand from "./deepl.ts";
import GoogleTranslateSubcommand from "./google.ts";

const subcommands: SubcommandDefinition[] = [
	DeeplTranslateSubcommand,
	GoogleTranslateSubcommand
];

export const TranslateSubcommands = new SubcommandCollection("translate", subcommands);
