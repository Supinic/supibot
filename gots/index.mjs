import { definition as FakeAgent } from "./fake-agent/index.mjs";
import { definition as GenericAPI } from "./generic-api/index.mjs";
import { definition as GitHub } from "./github/index.mjs";
import { definition as Global } from "./global/index.mjs";
import { definition as Google } from "./google/index.mjs";
import { definition as Helix } from "./helix/index.mjs";
import { definition as Leppunen } from "./leppunen/index.mjs";
import { definition as RaspberryPi4 } from "./raspberry-pi-4/index.mjs";
import { definition as Supibot } from "./supibot/index.mjs";
import { definition as Supinic } from "./supinic/index.mjs";
import { definition as TwitchGQL } from "./twitch-gql/index.mjs";
import { definition as TwitchEmotes } from "./twitch-emotes/index.mjs";

export const definitions = [
	FakeAgent,
	GenericAPI,
	GitHub,
	Global,
	Google,
	Helix,
	Leppunen,
	RaspberryPi4,
	Supibot,
	Supinic,
	TwitchEmotes,
	TwitchGQL
];

export default definitions;
