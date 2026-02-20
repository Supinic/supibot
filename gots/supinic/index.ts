import type { GotInstanceDefinition } from "supi-core";

export default {
	name: "Supinic",
	optionsType: "object",
	options: {
		prefixUrl: "https://supinic.com/api",
		timeout: {
			request: 30000
		}
	},
	parent: "Global",
	description: "Instance bound to the supinic.com API, used in various project-related commands"
} satisfies GotInstanceDefinition;
