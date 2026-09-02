import { type GotRegistryInstanceDefinition } from "supi-core";

export default {
	name: "GenericAPI",
	options: (() => ({
		mutableDefaults: true,
		throwHttpErrors: true
	})),
	parent: "Global"
} satisfies GotRegistryInstanceDefinition;
