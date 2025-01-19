import BanphraseApiSubcommand from "./banphrase-api.js";
import CheckLiveSubcommand from "./check-live.js";
import EnableRustlogSubcommand from "./enable-rustlog.js";
import GlobalEmotesSubcommand from "./global-emotes.js";
import LinksSubcommand from "./links.js";
import OfflineOnlySubcommand from "./offline-only.js";
import RejoinSubcommand from "./rejoin.js";
import RenameSubcommand from "./rename.js";
import ToggleSubcommand from "./toggle.js";

const subcommands = [
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

export default {
	subcommands
};
