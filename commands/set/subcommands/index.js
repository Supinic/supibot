import AmbassadorSubcommand from "./ambassador.ts";
import BirthdaySubcommand from "./birthday.ts";
import DefaultGptModelSubcommand from "./default-gpt-model.ts";
import DiscordSubcommand from "./discord.ts";
import GachiSubcommand from "./gachi.ts";
import LanguageSubcommand from "./language.ts";
import LeagueRegionSubcommand from "./league-region.ts";
import LeagueUserSubcommand from "./league-user.ts";
import LocationSubcommand from "./location.ts";
import NoAbbChatterSubcommand from "./no-abb-chatter.ts";
import OSRSUsernameSubcommand from "./osrs-username.ts";
import ReminderSubcommand from "./reminder.ts";
import StalkPreventionSubcommand from "./stalk-prevention.ts";
import SuggestionSubcommand from "./suggestion.ts";
import TrackFavouriteSubcommand from "./track-favourite.ts";

import ChannelFlagsSubcommands from "./channel-flags.ts";

export default [
	AmbassadorSubcommand,
	BirthdaySubcommand,
	DefaultGptModelSubcommand,
	DiscordSubcommand,
	GachiSubcommand,
	LanguageSubcommand,
	LeagueRegionSubcommand,
	LeagueUserSubcommand,
	LocationSubcommand,
	NoAbbChatterSubcommand,
	OSRSUsernameSubcommand,
	ReminderSubcommand,
	StalkPreventionSubcommand,
	SuggestionSubcommand,
	TrackFavouriteSubcommand,

	...ChannelFlagsSubcommands
];
