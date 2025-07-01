import { SubcommandCollection, type SubcommandDefinition } from "../../../classes/command.js";

import DeeplTranslateSubcommand from "./deepl.js";
import GoogleTranslateSubcommand from "./google.js";

const subcommands: SubcommandDefinition[] = [
	DeeplTranslateSubcommand,
	GoogleTranslateSubcommand
];

export const TranslateSubcommands = new SubcommandCollection("translate", subcommands);
