import type { GotInstanceDefinition } from "supi-core";

export default {
	name: "GitHub",
	optionsType: "function",
	options: (() => {
		if (!process.env.API_GITHUB_KEY) {
			return {
				prefixUrl: "https://api.github.com"
			};
		}

		return {
			prefixUrl: "https://api.github.com",
			headers: {
				Authorization: `Bearer ${process.env.API_GITHUB_KEY}`
			}
		};
	}),
	parent: "Global",
	description: "Sets up a GitHub instance with the API key, if available. Otherwise reverts to no-auth."
} satisfies GotInstanceDefinition;
