const url = "https://secure.runescape.com/m=news/latestNews.json?oldschool=1";
const OSRS_LATEST_ARTICLE_ID = "osrs-last-article-id";

module.exports = {
	name: "OSRS",
	aliases: [],
	notes: "Every 5 minutes, Supibot checks for news on the Old School Runescape website. If a new article is detected, you will be notified in the channel you subscribed in.",
	channelSpecificMention: true,
	response: {
		added: "You will now be pinged whenever a new OSRS article is published.",
		removed: "You will no longer receive pings when a new OSRS article is published."
	},
	generic: true,
	cronExpression: "0 */5 * * * *",
	subName: "OSRS article",
	type: "custom",
	process: async () => {
		const response = await sb.Got("GenericAPI", {
			url,
			responseType: "json",
			throwHttpErrors: true
		});

		if (!response.ok) {
			return;
		}

		const { newsItems } = response.body;
		const previousArticleId = await sb.Cache.getByPrefix(OSRS_LATEST_ARTICLE_ID) ?? 0;

		// Huge assumption: Jagex will release new articles on "top" of the JSON feed
		const previousArticleIndex = newsItems.findIndex(i => i.newsId === previousArticleId);
		const eligibleArticles = (previousArticleIndex === -1)
			? newsItems
			: newsItems.slice(0, previousArticleId);

		const latestArticleId = eligibleArticles[0].newsId;
		await sb.Cache.setByPrefix(OSRS_LATEST_ARTICLE_ID, latestArticleId, {
			expiry: 14 * 864e5 // 14 days
		});

		const articleString = eligibleArticles.map(i => `${i.title} ${i.link}`).join(" -- ");
		const noun = (eligibleArticles.length === 0) ? "article" : "articles";
		return {
			message: `New OSRS ${noun}! ${articleString}`
		};
	}
};
