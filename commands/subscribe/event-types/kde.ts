import type { RssEventDefinition } from "../generic-event.js";

export default {
	name: "KDE news",
	aliases: ["kde"],
	channelSpecificMention: true,
	response: {
		added: "You will now be pinged whenever a new KDE article is posted.",
		removed: "You will no longer receive pings for KDE articles."
	},
	generic: true,
	cronExpression: "0 */5 * * * *",
	subName: "KDE article",
	type: "rss",
	cacheKey: "kde-last-publish-date",
	url: "https://kde.org/index.xml"
} satisfies RssEventDefinition;
