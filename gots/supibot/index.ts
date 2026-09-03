import type { GotRegistryInstanceDefinition } from "supi-core";

export default {
	name: "Supibot",
	options: (() => {
		const secure = process.env.SUPIBOT_API_SECURE ?? false;
		const protocol = (secure) ? "https" : "http";
		const port = process.env.SUPIBOT_API_PORT ?? 80;

		return {
			prefixUrl: `${protocol}://localhost:${port}`,
			allowAbsoluteUrls: false
		};
	}),
	parent: "Global"
} satisfies GotRegistryInstanceDefinition;
