import type { GotRegistryInstanceDefinition } from "supi-core";

import GlobalGot from "./global/index.ts";
import FakeAgentGot from "./fake-agent/index.ts";
import GenericAPIGot from "./generic-api/index.ts";
import GitHubGot from "./github/index.ts";
import GoogleGot from "./google/index.ts";
import HelixGot from "./helix/index.ts";
import IVRGot from "./ivr/index.ts";
import RaspberryPi4Got from "./raspberry-pi-4/index.ts";
import RedditGot from "./reddit/index.ts";
import SupibotGot from "./supibot/index.ts";
import SupinicGot from "./supinic/index.ts";
import TwitchGQLGot from "./twitch-gql/index.ts";

export const definitions = [
	GlobalGot,
	FakeAgentGot,
	GenericAPIGot,
	GitHubGot,
	GoogleGot,
	HelixGot,
	IVRGot,
	RaspberryPi4Got,
	RedditGot,
	SupibotGot,
	SupinicGot,
	TwitchGQLGot
] satisfies GotRegistryInstanceDefinition[];
