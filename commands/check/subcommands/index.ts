import { SubcommandCollection, type SubcommandDefinition } from "../../../classes/command.ts";

import AfkSubcommand from "./afk.ts";
import AmbassadorSubcommand from "./ambassador.ts";
import ChangelogSubcommand from "./changelog.ts";
import ChatGptSubcommand from "./chat-gpt.ts";
import CookieSubcommand from "./cookie.ts";
import DeeplSubcommand from "./deepl.ts";
import ErrorInspectSubcommand from "./error-inspect.ts";
import LocationSubcommand from "./location.ts";
import LogsSubcommand from "./logs.ts";
import MariadbSubcommand from "./mariadb.ts";
import ReminderSubcommand from "./reminder.ts";
import SlotsSubcommand from "./slots.ts";
import SubscriptionSubcommand from "./subscription.ts";
import SuggestionSubcommand from "./suggestion.ts";

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
	SuggestionSubcommand
];

export const CheckSubcommands = new SubcommandCollection("check", subcommands);
