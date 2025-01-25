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
	description: null
};
