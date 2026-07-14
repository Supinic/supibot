import type { SpecialEventDefinition } from "../generic-event.js";

export default {
	title: "Changelog",
	names: ["changelog"],
	type: "special",
	notes: "Posts news updates about changes to Supibot's code.",
	channelSpecificMention: false,
	response: {
		added: "You will now receive a reminder whenever a new changelog is posted.",
		removed: "You will no longer receive changelog reminders."
	}
} satisfies SpecialEventDefinition;
