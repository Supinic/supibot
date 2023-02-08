import { definition as CommanderRoot } from "./commander-root/index.mjs";
import { definition as FakeAgent } from "./fake-agent/index.mjs";
import { definition as GenericAPI } from "./generic-api/index.mjs";
import { definition as GitHub } from "./github/index.mjs";
import { definition as Global } from "./global/index.mjs";
import { definition as Google } from "./google/index.mjs";
import { definition as Helix } from "./helix/index.mjs";
import { definition as Kraken } from "./kraken/index.mjs";
import { definition as Leppunen } from "./leppunen/index.mjs";
import { definition as Reddit } from "./reddit/index.mjs";
import { definition as RaspberryPi4 } from "./raspberry-pi-4/index.mjs";
import { definition as Speedrun } from "./speedrun/index.mjs";
import { definition as SRA } from "./sra/index.mjs";
import { definition as Supibot } from "./supibot/index.mjs";
import { definition as Supinic } from "./supinic/index.mjs";
import { definition as TwitchGQL } from "./twitch-gql/index.mjs";
import { definition as V5 } from "./v5/index.mjs";
import { definition as Vimeo } from "./vimeo/index.mjs";

const definitions = [
	CommanderRoot,
	FakeAgent,
	GenericAPI,
	GitHub,
	Global,
	Google,
	Helix,
	Kraken,
	Leppunen,
	Reddit,
	RaspberryPi4,
	Speedrun,
	SRA,
	Supibot,
	Supinic,
	TwitchGQL,
	V5,
	Vimeo
];

export { definitions };
export default definitions;
