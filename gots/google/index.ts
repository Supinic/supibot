import type { GotRegistryInstanceDefinition } from "supi-core";

export default {
	name: "Google",
	options: {
		prefixUrl: "https://maps.googleapis.com/maps/api",
		throwHttpErrors: true,
		allowAbsoluteUrls: false
	},
	parent: "Global"
} satisfies GotRegistryInstanceDefinition;
