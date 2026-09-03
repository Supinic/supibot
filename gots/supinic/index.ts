import type { GotRegistryInstanceDefinition } from "supi-core";

export default {
	name: "Supinic",
	options: {
		prefixUrl: "https://supinic.com/api",
		allowAbsoluteUrls: false,
		timeout: {
			request: 30000
		}
	},
	parent: "Global"
} satisfies GotRegistryInstanceDefinition;
