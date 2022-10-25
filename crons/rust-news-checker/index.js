module.exports = {
	Name: "rust-news-checker",
	Expression: "0 */15 * * * *",
	Description: "Checks for new Rust (programming language) articles, and posts updates for subscribed users.",
	Defer: null,
	Type: "Bot",
	Code: (async function checkRustNews () {
		const { handleSubscription, parseRssNews } = require("../subscription-utils.js");
		this.data.isTableAvailable ??= await sb.Query.isTablePresent("data", "Event_Subscription");
		if (this.data.isTableAvailable === false) {
			this.stop();
			return;
		}

		const response = await sb.Got("GenericAPI", {
			url: "https://blog.rust-lang.org/feed.xml",
			responseType: "text"
		});

		if (response.statusCode !== 200) {
			return;
		}

		const cacheKey = "rust-news-last-publish-date";
		const result = await parseRssNews(response.body, cacheKey);
		if (!result) {
			return;
		}

		const suffix = (result.length === 1) ? "" : "s";
		const message = `New Rust article${suffix}! PagChomp 👉 ${result.join(" -- ")}`;
		await handleSubscription("Rust", message);
	})
};
