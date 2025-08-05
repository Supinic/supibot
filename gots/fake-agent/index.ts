import type { GotInstanceDefinition } from "supi-core";

export default {
	name: "FakeAgent",
	optionsType: "object",
	options: {
		headers: {
			"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
		}
	},
	parent: "Global",
	description: "Pretends to describe a User-Agent, mostly used for scraping."
} satisfies GotInstanceDefinition;
