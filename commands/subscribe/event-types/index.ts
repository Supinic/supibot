import { GenericEventDefinition, SpecialEventDefinition } from "../generic-event.js";

import BrighterShoresSubDefinition from "./brighter-shores.js";
import BunSubDefinition from "./bun.js";
import ChangelogSubDefinition from "./changelog.js";
import ChannelLiveSubDefinition from "./channel-live.js";
import DenoSubDefinition from "./deno.js";
import DotnetSubDefinition from "./dotnet.js";
import FactorioSubDefinition from "./factorio.js";
import GrindingGearGamesSubDefinition from "./ggg.js";
import MicrosoftCppSubDefinition from "./msvcpp.js";
import NodeSubDefinition from "./nodejs.js";
import OsrsSubDefinition from "./osrs.js";
import PythonSubDefinition from "./python.js";
import RuneliteSubDefinition from "./runelite.js";
import RustSubDefinition from "./rust.js";
import SteamGiveawayDefinition from "./steam-giveaway.js";
import SuggestionSubDefinition from "./suggestion.js";
import V8SubDefinition from "./v8.js";

export default [
	BrighterShoresSubDefinition,
	BunSubDefinition,
	ChangelogSubDefinition,
	ChannelLiveSubDefinition,
	DenoSubDefinition,
	DotnetSubDefinition,
	FactorioSubDefinition,
	GrindingGearGamesSubDefinition,
	MicrosoftCppSubDefinition,
	NodeSubDefinition,
	OsrsSubDefinition,
	PythonSubDefinition,
	RuneliteSubDefinition,
	RustSubDefinition,
	SteamGiveawayDefinition,
	SuggestionSubDefinition,
	V8SubDefinition
] satisfies Array<GenericEventDefinition | SpecialEventDefinition>;
