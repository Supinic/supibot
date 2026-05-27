import { SubcommandCollection, type SubcommandDefinition } from "../../../classes/command.js";

import ActiveChatterStatistic from "./active-chatters.js";
import { AfkStatistic, LongestAfkStatistic } from "./afk.js";
import AliasStatistic from "./aliases.js";
import { TotalCookieCountStatistic, UserCookieCountStatistic } from "./cookies.js";
import DiscordStatistic from "./discord.js";
import GptStatistic from "./gpt.js";
import ReminderStatistic from "./reminders.js";
import SuggestionStatistic from "./suggestions.js";
import TwitchLottoStatistic from "./twitch-lotto.js";

const subcommands: SubcommandDefinition[] = [
	ActiveChatterStatistic,
	AfkStatistic,
	LongestAfkStatistic,
	AliasStatistic,
	TotalCookieCountStatistic,
	UserCookieCountStatistic,
	DiscordStatistic,
	GptStatistic,
	ReminderStatistic,
	SuggestionStatistic,
	TwitchLottoStatistic
];

export const StatsSubcommands = new SubcommandCollection("stats", subcommands);
