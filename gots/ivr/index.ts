import type { GotInstanceDefinition } from "supi-core";

export default {
	name: "IVR",
	optionsType: "object",
	options: {
		prefixUrl: "https://api.ivr.fi"
	},
	parent: "Global",
	description: "IVR"
} satisfies GotInstanceDefinition;
