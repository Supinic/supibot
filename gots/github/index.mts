import { Config } from "supi-core";

export const definition = {
	name: "GitHub",
	optionsType: "function",
	options: (() => {
		if (!Config.has("API_GITHUB_KEY", true)) {
			return {
				prefixUrl: "https://api.github.com"
			};
		}

		const token = Config.get("API_GITHUB_KEY", true);
		return {
			prefixUrl: "https://api.github.com",
			headers: {
				Authorization: `Bearer ${token}`
			}
		};
	}),
	parent: "Global",
	description: null
};
