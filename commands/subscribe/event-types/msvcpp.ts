import { RssEventDefinition } from "../generic-event.js";

export default {
	name: "MSVC++",
	aliases: ["msvc++", "MSVCPP", "msvcpp"],
	notes: "Every five minutes, Supibot checks new devblogs on Microsoft's Visual Studio C++ website. If a new article is detected, you will be notified in the channel you subscribed in.",
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
	url: "https://devblogs.microsoft.com/cppblog/feed"
} satisfies RssEventDefinition;
