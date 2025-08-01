import AmbassadorSubcommand from "./ambassador.js";
import BirthdaySubcommand from "./birthday.js";
import DefaultGptModelSubcommand from "./default-gpt-model.js";
import DiscordSubcommand from "./discord.js";
import GachiSubcommand from "./gachi.js";
import LanguageSubcommand from "./language.js";
import LeagueRegionSubcommand from "./league-region.js";
import LeagueUserSubcommand from "./league-user.js";
import LocationSubcommand from "./location.js";
import NoAbbChatterSubcommand from "./no-abb-chatter.js";
import OSRSUsernameSubcommand from "./osrs-username.js";
import ReminderSubcommand from "./reminder.js";
import StalkPreventionSubcommand from "./stalk-prevention.js";
import SuggestionSubcommand from "./suggestion.js";
import TrackFavouriteSubcommand from "./track-favourite.js";

import ChannelFlagsSubcommands from "./channel-flags.js";
import TwitchLottoSubcommands from "./twitch-lotto.js";

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

	...ChannelFlagsSubcommands,
	...TwitchLottoSubcommands
];
