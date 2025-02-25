import { RssEventDefinition } from "../generic-event.js";

export default {
	name: "Bun",
	aliases: [],
	notes: "Posts new Bun blogposts whenever one is published",
	channelSpecificMention: true,
	response: {
		added: "You will now be pinged whenever a new Bun blogpost is published.",
		removed: "You will no longer receive pings when a new Bun blogpost is published."
	},
	generic: true,
	cronExpression: "0 */5 * * * *",
	subName: "Bun blogpost",
	type: "rss",
	cacheKey: "bun-blogpost-last-publish-date",
	url: "https://bun.sh/rss.xml"
} satisfies RssEventDefinition;
