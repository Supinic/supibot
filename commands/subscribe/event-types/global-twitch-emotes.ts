import type { SpecialEventDefinition } from "../generic-event.js";

export default {
	name: "Global Twitch emotes",
	aliases: ["global-emotes", "global-twitch-emotes"],
	type: "special",
	generic: false,
	notes: "Every five minutes, Supibot checks whether Twitch has added or removed global emotes. You will be pinged in @Supinic's channel whenever such a change is detected.",
	channelSpecificMention: false,
	response: {
		added: "You will now receive pings whenever Twitch emotes are added or deleted.",
		removed: "You will no longer receive pings whenever Twitch emotes are added or deleted."
	}
} satisfies SpecialEventDefinition;
