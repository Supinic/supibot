import { SubcommandCollection, SubcommandDefinition } from "../../../classes/command.js";

import AfkSubcommand from "./afk.js";
import AmbassadorSubcommand from "./ambassador.js";
import ChangelogSubcommand from "./changelog.js";
import ChatGptSubcommand from "./chat-gpt.js";
import CookieSubcommand from "./cookie.js";
import DeeplSubcommand from "./deepl.js";
import ErrorInspectSubcommand from "./error-inspect.js";
import LocationSubcommand from "./location.js";
import LogsSubcommand from "./logs.js";
import MariadbSubcommand from "./mariadb.js";
import ReminderSubcommand from "./reminder.js";
import SlotsSubcommand from "./slots.js";
import SubscriptionSubcommand from "./subscription.js";
import SuggestionSubcommand from "./suggestion.js";
import { TwitchLottoBlacklistSubcommand, TwitchLottoDescriptionSubcommand } from "./twitch-lotto.js";

const subcommands: SubcommandDefinition[] = [
	AfkSubcommand,
	AmbassadorSubcommand,
	ChangelogSubcommand,
	ChatGptSubcommand,
	CookieSubcommand,
	DeeplSubcommand,
	ErrorInspectSubcommand,
	LocationSubcommand,
	LogsSubcommand,
	MariadbSubcommand,
	ReminderSubcommand,
	SlotsSubcommand,
	SubscriptionSubcommand,
	SuggestionSubcommand,
	TwitchLottoBlacklistSubcommand,
	TwitchLottoDescriptionSubcommand
];

export const CheckSubcommands = new SubcommandCollection("check", subcommands);
