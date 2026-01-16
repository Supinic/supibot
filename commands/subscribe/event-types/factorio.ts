import type { RssEventDefinition } from "../generic-event.js";

export default {
	name: "Factorio",
	aliases: [],
	notes: "Posts new Factorio blog posts",
	channelSpecificMention: true,
	response: {
		added: "You will now be pinged whenever a new Factorio blogpost is published.",
		removed: "You will no longer receive pings when a new Factorio blogpost is published."
	},
	generic: true,
	cronExpression: "0 */5 * * * *",
	cacheKey: "factorio-blogpost-last-publish-date",
	subName: "Factorio blogpost",
	type: "rss",
	url: "https://factorio.com/blog/rss"
} satisfies RssEventDefinition;
