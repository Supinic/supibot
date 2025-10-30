import { RssEventDefinition } from "../generic-event.js";

export default {
	name: "Asahi Linux",
	aliases: ["asahi", "asahilinux"],
	notes: "Posts new Asahi Linux blog posts whenever one is published",
	channelSpecificMention: true,
	response: {
		added: "You will now be pinged whenever a new Asahi Linux blog post is published.",
		removed: "You will no longer receive pings when a new Asahi Linux blog post is published."
	},
	generic: true,
	cronExpression: "0 */5 * * * *",
	subName: "Asahi Linux blog",
	type: "rss",
	cacheKey: "asahilinux-blog-last-publish-date",
	url: "https://asahilinux.org/blog/index.xml"
} satisfies RssEventDefinition;
