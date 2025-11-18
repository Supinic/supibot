import { RssEventDefinition } from "../generic-event.js";

export default {
	name: "Emojipedia",
	aliases: ["emoji"],
	notes: "Posts new Emojipedia blogposts whenever one is published",
	channelSpecificMention: true,
	response: {
		added: "You will now be pinged whenever a new Emojipedia blogpost is published.",
		removed: "You will no longer receive pings when a new Emojipedia blogpost is published."
	},
	generic: true,
	cronExpression: "0 */5 * * * *",
	subName: "Emojipedia blogpost",
	type: "rss",
	cacheKey: "emojipedia-blogpost-last-publish-date",
	url: "https://blog.emojipedia.org/rss/"
} satisfies RssEventDefinition;
