import type { SpecialEventDefinition } from "../generic-event.js";

export default {
	title: "Global Twitch emotes",
	names: ["global-twitch-emotes"],
	type: "special",
	notes: "Notifies when Twitch adds, changes or removes global emotes.",
	channelSpecificMention: false,
	response: {
		added: "You will now receive pings whenever Twitch emotes are added or deleted.",
		removed: "You will no longer receive pings whenever Twitch emotes are added or deleted."
	}
} satisfies SpecialEventDefinition;
