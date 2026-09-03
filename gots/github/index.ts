import type { GotRegistryInstanceDefinition } from "supi-core";

export default {
	name: "GitHub",
	options: (() => {
		if (!process.env.API_GITHUB_KEY) {
			return {
				prefixUrl: "https://api.github.com",
				allowAbsoluteUrls: false
			};
		}

		return {
			prefixUrl: "https://api.github.com",
			allowAbsoluteUrls: false,
			headers: {
				Authorization: `Bearer ${process.env.API_GITHUB_KEY}`
			}
		};
	}),
	parent: "Global"
} satisfies GotRegistryInstanceDefinition;
