import type { GotInstanceDefinition } from "supi-core";

export default {
	name: "TwitchEmotes",
	optionsType: "object",
	options: {
		responseType: "json",
		throwHttpErrors: false,
		timeout: {
			request: 10_000
		},
		retry: {
			limit: 0
		}
	},
	parent: "GenericAPI",
	description: "Shorthand for fetching of Twitch emotes from various sources, including Helix, and the third party providers"
} satisfies GotInstanceDefinition;
