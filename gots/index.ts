export type GotDefinition = {
	name: string;
	optionsType: "object" | "function";
	options: Record<string, unknown> | (() => Record<string, unknown>);
	parent: string | null;
	description: string | null;
};

import FakeAgentGot from "./fake-agent/index.js";
import GenericAPIGot from "./generic-api/index.js";
import GitHubGot from "./github/index.js";
import GlobalGot from "./global/index.js";
import GoogleGot from "./google/index.js";
import HelixGot from "./helix/index.js";
import IVRGot from "./ivr/index.js";
import RaspberryPi4Got from "./raspberry-pi-4/index.js";
import SupibotGot from "./supibot/index.js";
import SupinicGot from "./supinic/index.js";
import TwitchGQLGot from "./twitch-gql/index.js";
import TwitchEmotesGot from "./twitch-emotes/index.js";

export const definitions = [
	FakeAgentGot,
	GenericAPIGot,
	GitHubGot,
	GlobalGot,
	GoogleGot,
	HelixGot,
	IVRGot,
	RaspberryPi4Got,
	SupibotGot,
	SupinicGot,
	TwitchEmotesGot,
	TwitchGQLGot
] as GotDefinition[]; // @todo change to `satisfies` when gots are fully TS
