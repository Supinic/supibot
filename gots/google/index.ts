import type { GotInstanceDefinition } from "supi-core";

export default {
	name: "Google",
	optionsType: "object",
	options: {
		prefixUrl: "https://maps.googleapis.com/maps/api",
		throwHttpErrors: true
	},
	parent: "Global",
	description: "Google instance for the Maps API"
} satisfies GotInstanceDefinition;
