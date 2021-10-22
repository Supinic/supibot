import * as CommanderRoot from "./commander-root/index.mjs";
import * as FakeAgent from "./fake-agent/index.mjs";
import * as GenericAPI from "./generic-api/index.mjs";
import * as Global from "./global/index.mjs";
import * as Helix from "./helix/index.mjs";
import * as Kraken from "./kraken/index.mjs";
import * as Leppunen from "./leppunen/index.mjs";
import * as Reddit from "./reddit/index.mjs";
import * as Speedrun from "./speedrun/index.mjs";
import * as SRA from "./sra/index.mjs";
import * as Supibot from "./supibot/index.mjs";
import * as Supinic from "./supinic/index.mjs";
import * as V5 from "./v5/index.mjs";
import * as Vimeo from "./vimeo/index.mjs";

const definitions = [
	CommanderRoot,
	FakeAgent,
	GenericAPI,
	Global,
	Helix,
	Kraken,
	Leppunen,
	Reddit,
	Speedrun,
	SRA,
	Supibot,
	Supinic,
	V5,
	Vimeo
];

export { definitions };

export default definitions;
