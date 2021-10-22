export default {
	name: "Supibot",
	optionsType: "function",
	options: (() => {
		const secure = sb.Config.get("SUPIBOT_API_SECURE", false) ?? false;
		const protocol = (secure) ? "https" : "http";
		const port = sb.Config.get("SUPIBOT_API_PORT", false) ?? 80;

		return {
			prefixUrl: `${protocol}://localhost:${port}`
		};
	}),
	parent: "Global",
	description: null
};
