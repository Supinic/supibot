import { type GotInstanceDefinition } from "supi-core";

export default {
	name: "GenericAPI",
	optionsType: "function",
	options: (() => ({
		mutableDefaults: true,
		throwHttpErrors: true
	})),
	parent: "Global",
	description: "Generic API"
} satisfies GotInstanceDefinition;
