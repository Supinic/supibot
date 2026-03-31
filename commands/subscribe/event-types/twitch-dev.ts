import type { RssEventDefinition } from "../generic-event.js";

export default {
	name: "Twitch Developer Changelog",
	aliases: ["twitchdev"],
	channelSpecificMention: true,
	response: {
		added: "You will now be pinged whenever the Twitch developer documentation changes.",
		removed: "You will no longer receive pings for Twitch developer documentation changes."
	},
	generic: true,
	cronExpression: "0 */5 * * * *",
	subName: "Twitch Developer Changelog",
	type: "rss",
	cacheKey: "twitch-dev-last-publish-date",
	url: "https://dev.twitch.tv/docs/rss/change-log.xml"
} satisfies RssEventDefinition;
