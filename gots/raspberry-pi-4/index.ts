import type { GotRegistryInstanceDefinition } from "supi-core";

export default {
	name: "RaspberryPi4",
	options: {
		prefixUrl: "http://localhost:11111/proxy",
		allowAbsoluteUrls: false,
		timeout: {
			request: 10000
		}
	},
	parent: "GenericAPI"
} satisfies GotRegistryInstanceDefinition;
