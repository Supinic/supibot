export const definition = {
	name: "Supibot",
	optionsType: "function",
	options: (() => {
		const secure = process.env.SUPIBOT_API_SECURE ?? false;
		const protocol = (secure) ? "https" : "http";
		const port = process.env.SUPIBOT_API_PORT ?? 80;

		return {
			prefixUrl: `${protocol}://localhost:${port}`
		};
	}),
	parent: "Global",
	description: null
};
