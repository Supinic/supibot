import { RssEventDefinition } from "../generic-event.js";

export default {
	name: "GitHub Blog",
	aliases: ["github-blog", "github"],
	notes: "Posts new GitHub blogposts whenever one is published",
	channelSpecificMention: true,
	response: {
		added: "You will now be pinged whenever a new GitHub blogpost is published.",
		removed: "You will no longer receive pings when a new GitHub blogpost is published."
	},
	generic: true,
	cronExpression: "0 */5 * * * *",
	subName: "GitHub blogpost",
	type: "rss",
	cacheKey: "github-blogpost-last-publish-date",
	url: "https://archlinux.org/feeds/news/",
	options: {
		ignoredCategories: ["github copilot"]
	}
} satisfies RssEventDefinition;
