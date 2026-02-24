import type { RssEventDefinition } from "../generic-event.js";

export default {
	name: "Runelite",
	aliases: [],
	notes: "Notifies about new releases of Runelite.",
	channelSpecificMention: true,
	response: {
		added: "You will now be pinged whenever a new release of Runelite is detected.",
		removed: "You will no longer receive pings when Runelite releases an update."
	},
	generic: true,
	cronExpression: "0 */5 * * * *",
	cacheKey: "runelite-release-last-publish-date",
	subName: "Runelite version",
	type: "rss",
	url: "https://runelite.net/atom.xml"
} satisfies RssEventDefinition;
