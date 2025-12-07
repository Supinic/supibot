import { RssEventDefinition } from "../generic-event.js";

export default {
	name: "Cloudflare Developer Products",
	aliases: ["cfdev"],
	notes: "Posts new Cloudflare Developer products updates",
	channelSpecificMention: true,
	response: {
		added: "You will now be pinged whenever a Cloudflare Developer product is updated.",
		removed: "You will no longer receive pings when a Cloudflare Developer product is updated."
	},
	generic: true,
	cronExpression: "0 */5 * * * *",
	subName: "Cloudflare Developer products update",
	type: "rss",
	cacheKey: "cloudflare-developer-updates-last-publish-date",
	url: "https://developers.cloudflare.com/changelog/rss/developer-platform.xml"
} satisfies RssEventDefinition;
