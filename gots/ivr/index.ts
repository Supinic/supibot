import type { GotRegistryInstanceDefinition } from "supi-core";

export default {
	name: "IVR",
	options: {
		prefixUrl: "https://api.ivr.fi",
		allowAbsoluteUrls: false
	},
	parent: "Global"
} satisfies GotRegistryInstanceDefinition;
