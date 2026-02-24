import type { RssEventDefinition } from "../generic-event.js";

export default {
	name: "Python",
	aliases: ["4Head"],
	channelSpecificMention: true,
	response: {
		added: "You will now be pinged whenever a new Python version is published.",
		removed: "You will no longer receive pings when Python is updated."
	},
	generic: true,
	cronExpression: "0 */5 * * * *",
	cacheKey: "python-release-last-publish-date",
	subName: "Python version",
	type: "rss",
	url: "https://blog.python.org/feeds/posts/default"
} satisfies RssEventDefinition;
