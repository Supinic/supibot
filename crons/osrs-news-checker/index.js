module.exports = {
	Name: "nodejs",
	Expression: "0 */15 * * * *",
	Description: "Checks for new OSRS articles, and posts updates for subscribed users.",
	Defer: null,
	Type: "Bot",
	Code: (async function checkLastNodeVersion () {
		const { handleSubscription } = require("../subscription-utils.js");
		this.data.isTableAvailable ??= await sb.Query.isTablePresent("data", "Event_Subscription");
		if (this.data.isTableAvailable === false) {
			this.stop();
			return;
		}

		const response = await sb.Got("GenericAPI", {
			url: "https://secure.runescape.com/m=news/latest_news.rss?oldschool=true",
			responseType: "text"
		});

		if (response.statusCode !== 200) {
			return;
		}

		const key = "osrs-news-last-publish-date";
		const feed = await sb.Utils.parseRSS(response.body);
		const lastPublishDate = await sb.Cache.getByPrefix(key) ?? 0;
		const eligibleArticles = feed.items
			.filter(i => new sb.Date(i.pubDate) > lastPublishDate)
			.sort((a, b) => new sb.Date(b.pubDate) - new sb.Date(a.pubDate));

		if (eligibleArticles.length === 0) {
			return;
		}

		const [topArticle] = eligibleArticles;
		await sb.Cache.setByPrefix(key, new sb.Date(topArticle.pubDate).valueOf(), {
			expiry: 7 * 864e5 // 7 days
		});

		// Skip posting too many articles if it's the first time running
		if (eligibleArticles.length > 1 && lastPublishDate === 0) {
			return;
		}

		const result = [];
		for (const article of eligibleArticles) {
			const { link, title } = article;
			result.push(`${title} ${link}`);
		}

		const suffix = (eligibleArticles.length === 1) ? "" : "s";
		const message = `New OSRS article${suffix}! PagChomp 👉 ${result.join(" -- ")}`;
		await handleSubscription("OSRS", message);
	})
};
