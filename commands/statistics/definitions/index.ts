import * as z from "zod";
import { SubcommandCollection, type SubcommandDefinition } from "../../../classes/command.ts";

import ActiveChatterStatistic from "./active-chatters.ts";
import { AfkStatistic, LongestAfkStatistic } from "./afk.ts";
import AliasStatistic from "./aliases.ts";
import { TotalCookieCountStatistic, UserCookieCountStatistic } from "./cookies.ts";
import DiscordStatistic from "./discord.ts";
import GptStatistic from "./gpt.ts";
import ReminderStatistic from "./reminders.ts";
import TopChattersStatistic from "./top-chatters.ts";

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
	TopChattersStatistic
];

// check all statistics are lowercased - needed to ensure that lowercasing user input is valid
const shape = z.array(z.object({ name: z.string().lowercase() }));
shape.parse(subcommands);

export const StatsSubcommands = new SubcommandCollection("stats", subcommands);
