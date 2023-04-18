export const definition = {
	name: "GitHub",
	optionsType: "function",
	options: (() => {
		if (!sb.Config.has("API_GITHUB_KEY", true)) {
			return {
				prefixUrl: "https://api.github.com"
			};
		}

		const token = sb.Config.get("API_GITHUB_KEY", true);
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
