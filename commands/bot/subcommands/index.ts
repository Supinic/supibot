import { SubcommandCollection, type SubcommandDefinition } from "../../../classes/command.ts";

import BanphraseApiSubcommand from "./banphrase-api.ts";
import CheckLiveSubcommand from "./check-live.ts";
import EnableRustlogSubcommand from "./enable-rustlog.ts";
import GlobalEmotesSubcommand from "./global-emotes.ts";
import LinksSubcommand from "./links.ts";
import OfflineOnlySubcommand from "./offline-only.ts";
import RejoinSubcommand from "./rejoin.ts";
import RenameSubcommand from "./rename.ts";
import ToggleSubcommand from "./toggle.ts";

const subcommands: SubcommandDefinition[] = [
	BanphraseApiSubcommand,
	CheckLiveSubcommand,
	EnableRustlogSubcommand,
	GlobalEmotesSubcommand,
	LinksSubcommand,
	OfflineOnlySubcommand,
	RejoinSubcommand,
	RenameSubcommand,
	ToggleSubcommand
];

export const BotSubcommands = new SubcommandCollection("bot", subcommands);
