import type { RssEventDefinition } from "../generic-event.js";

export default {
	name: "MSVC++",
	aliases: ["msvcpp"],
	channelSpecificMention: true,
	response: {
		added: "You will now be pinged whenever a new MSVC++ devblog is published.",
		removed: "You will no longer receive pings when a new MSVC++ devblog is published."
	},
	generic: true,
	cronExpression: "0 */5 * * * *",
	cacheKey: "msvcpp-blog-last-publish-date",
	subName: "MSVC++ devblog",
	type: "rss",
	url: "https://devblogs.microsoft.com/cppblog/feed",
	options: {
		ignoredCategories: ["copilot"]
	}
} satisfies RssEventDefinition;
