export const definition = {
	name: "GitHub",
	optionsType: "object",
	headers: {
		Authorization: sb.Config.get("API_GITHUB_KEY")
	},
	options: (() => {
		if (!sb.Config.has("API_GITHUB_KEY")) {
			throw new Error("GitHub sb.Got instance cannot initialize - missing client-id");
		}

		const token = sb.Config.get("API_GITHUB_KEY", false);
		if (!token) {
			throw new Error("GitHub sb.Got instance cannot initialize - missing token");
		}

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
