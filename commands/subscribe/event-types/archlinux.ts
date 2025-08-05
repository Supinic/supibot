import { RssEventDefinition } from "../generic-event.js";

export default {
	name: "Arch Linux",
	aliases: ["arch", "archlinux"],
	notes: "Posts new Arch Linux news articles whenever one is published",
	channelSpecificMention: true,
	response: {
		added: "You will now be pinged whenever a new Arch Linux article is published.",
		removed: "You will no longer receive pings when a new Arch Linux article is published."
	},
	generic: true,
	cronExpression: "0 */5 * * * *",
	subName: "Arch Linux article",
	type: "rss",
	cacheKey: "archlinux-article-last-publish-date",
	url: "https://archlinux.org/feeds/news/"
} satisfies RssEventDefinition;
