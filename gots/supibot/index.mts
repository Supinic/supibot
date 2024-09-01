import { Config } from "supi-core";

export const definition = {
	name: "Supibot",
	optionsType: "function",
	options: (() => {
		const secure = Config.get("SUPIBOT_API_SECURE", false) ?? false;
		const protocol = (secure) ? "https" : "http";
		const port = Config.get("SUPIBOT_API_PORT", false) ?? 80;

		return {
			prefixUrl: `${protocol}://localhost:${port}`
		};
	}),
	parent: "Global",
	description: null
};
