import { SubcommandCollection, type SubcommandDefinition } from "../../../classes/command.js";

import ActiveChatterStatistic from "./active-chatters.js";
import { AfkStatistic, LongestAfkStatistic } from "./afk.js";
import AliasNameStatistic from "./alias-names.js";
import AliasStatistic from "./aliases.js";
import CookieCountStatistic from "./cookie-count.js";
import DalleStatistic from "./dalle.js";
import DiscordStatistic from "./discord.js";
import GptStatistic from "./gpt.js";
import MarkovStatistic from "./markov.js";
import PlaysoundStatistic from "./playsounds.js";
import ReminderStatistic from "./reminders.js";
import SongRequestStatistic from "./song-requests.js";
import SuggestionStatistic from "./suggestions.js";
import SupibotStatistic from "./supibot.js";
import TwitchLottoStatistic from "./twitch-lotto.js";

const subcommands: SubcommandDefinition[] = [
	ActiveChatterStatistic,
	AfkStatistic,
	LongestAfkStatistic,
	AliasNameStatistic,
	AliasStatistic,
	CookieCountStatistic,
	DalleStatistic,
	DiscordStatistic,
	GptStatistic,
	MarkovStatistic,
	PlaysoundStatistic,
	ReminderStatistic,
	SongRequestStatistic,
	SuggestionStatistic,
	SupibotStatistic,
	TwitchLottoStatistic
];

export const StatsSubcommands = new SubcommandCollection("stats", subcommands);
