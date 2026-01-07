import type { SpecialEventDefinition } from "../generic-event.js";

export default {
	name: "Suggestion",
	aliases: ["suggest", "suggestions"],
	type: "special",
	generic: false,
	notes: "Whenever a suggestion you've made is updated, you will receive a private system reminder about it. Changes are detected every minute.",
	channelSpecificMention: false,
	response: {
		added: "You will now receive private system reminders whenever a suggestion you made changes.",
		removed: "You will no longer receive suggestion reminders."
	}
} satisfies SpecialEventDefinition;
