import { SpecialEventDefinition } from "../generic-event.js";

export default {
	name: "Changelog",
	aliases: [],
	notes: "Every minute, Supibot checks for new changelogs. If you are subscribed, you will receive a private system reminder from Supibot.",
	channelSpecificMention: false,
	response: {
		added: "You will now receive a reminder whenever a new changelog is posted.",
		removed: "You will no longer receive changelog reminders."
	}
} satisfies SpecialEventDefinition;
