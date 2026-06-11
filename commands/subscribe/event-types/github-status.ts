import type { RssEventDefinition } from "../generic-event.js";

export default {
	name: "GitHub Status",
	aliases: ["githubstatus"],
	channelSpecificMention: true,
	response: {
		added: "You will now be pinged whenever GitHub goes down.",
		removed: "You will no longer receive pings when GitHub goes down."
	},
	generic: true,
	cronExpression: "0 */5 * * * *",
	subName: "GitHub incident",
	type: "rss",
	cacheKey: "github-status-last-publish-date",
	url: "https://www.githubstatus.com/history.rss"
} satisfies RssEventDefinition;
