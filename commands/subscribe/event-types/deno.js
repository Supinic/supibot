module.exports = {
	name: "Deno",
	aliases: [],
	notes: "Deno article",
	channelSpecificMention: true,
	response: {
		added: "You will now be pinged whenever a new Deno article is published.",
		removed: "You will no longer receive pings when a new Deno article is published."
	},
	generic: true,
	cronExpression: "0 */5 * * * *",
	cacheKey: "deno-article-last-publish-date",
	subName: "Deno article",
	type: "rss",
	url: "https://deno.com/feed"
};
