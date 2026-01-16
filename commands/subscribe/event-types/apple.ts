import type { RssEventDefinition } from "../generic-event.js";

export default {
	name: "Apple Newsroom",
	aliases: ["apple"],
	notes: "Posts new Apple Newsroom articles",
	channelSpecificMention: true,
	response: {
		added: "You will now be pinged whenever a new Apple Newsroom article is posted.",
		removed: "You will no longer receive pings for Apple Newsroom articles."
	},
	generic: true,
	cronExpression: "0 */5 * * * *",
	subName: "Apple Newsroom article",
	type: "rss",
	cacheKey: "apple-newsroom-last-publish-date",
	url: "https://www.apple.com/newsroom/rss-feed.rss"
} satisfies RssEventDefinition;
