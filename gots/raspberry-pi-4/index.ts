import type { GotInstanceDefinition } from "supi-core";

export default {
	name: "RaspberryPi4",
	optionsType: "object",
	options: {
		prefixUrl: "http://localhost:11111/proxy",
		timeout: {
			request: 10000
		}
	},
	parent: "GenericAPI",
	description: "Localhost API, only used for Supinic's RPi4 communication - should probably be configurable and not hardcoded"
} satisfies GotInstanceDefinition;
