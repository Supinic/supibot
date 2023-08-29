module.exports = {
	name: "OSRS",
	aliases: [],
	notes: "Every 15 minutes, Supibot checks for news on the Old School Runescape website. If a new article is detected, you will be notified in the channel you subscribed in.",
	channelSpecificMention: true,
	response: {
		added: "You will now be pinged whenever a new OSRS article is published.",
		removed: "You will no longer receive pings when a new OSRS article is published."
	},
	generic: true,
	cronExpression: "0 */5 * * * *",
	cacheKey: "osrs-article-last-publish-date",
	subName: "OSRS article",
	type: "rss",
	url: "https://secure.runescape.com/m=news/latest_news.rss?oldschool=true"
};
