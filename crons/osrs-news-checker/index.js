module.exports = {
	Name: "osrs-news-checker",
	Expression: "0 */15 * * * *",
	Description: "Checks for new OSRS articles, and posts updates for subscribed users.",
	Defer: null,
	Type: "Bot",
	Code: (async function checkOldSchoolRunescapeNews () {
		const { handleSubscription, parseRssNews } = require("../subscription-utils.js");
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

		const cacheKey = "osrs-news-last-publish-date";
		const result = await parseRssNews(response.body, cacheKey);
		if (!result) {
			return;
		}

		const suffix = (result.length === 1) ? "" : "s";
		const message = `New OSRS article${suffix}! PagChomp 👉 ${result.join(" -- ")}`;
		await handleSubscription("OSRS", message);
	})
};
