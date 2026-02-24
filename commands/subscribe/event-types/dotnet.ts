import type { RssEventDefinition } from "../generic-event.js";

export default {
	name: ".NET",
	aliases: [".net"],
	channelSpecificMention: true,
	response: {
		added: "You will now be pinged whenever a new .NET devblog is published.",
		removed: "You will no longer receive pings when a new .NET devblog is published."
	},
	generic: true,
	cronExpression: "0 */5 * * * *",
	cacheKey: "dotnet-blog-last-publish-date",
	subName: ".NET devblog",
	type: "rss",
	url: "https://devblogs.microsoft.com/dotnet/feed",
	options: {
		ignoredCategories: ["copilot"]
	}
} satisfies RssEventDefinition;
