import type { SpecialEventDefinition } from "../generic-event.js";

export default {
	name: "Global Twitch emotes",
	aliases: ["global-twitch-emotes"],
	type: "special",
	generic: false,
	notes: "Notifies when Twitch adds, changes or removes global emotes.",
	channelSpecificMention: false,
	response: {
		added: "You will now receive pings whenever Twitch emotes are added or deleted.",
		removed: "You will no longer receive pings whenever Twitch emotes are added or deleted."
	}
} satisfies SpecialEventDefinition;
