export const definition = {
	Name: "python-news-checker",
	Expression: "0 */5 * * * *",
	Description: "Checks for new Python releases, and posts updates for subscribed users.",
	Defer: null,
	Type: "Bot",
	Code: (async function checkDotNetNews () {
		const { handleSubscription, parseRssNews } = await import("../subscription-utils.mjs");
		this.data.isTableAvailable ??= await sb.Query.isTablePresent("data", "Event_Subscription");
		if (this.data.isTableAvailable === false) {
			this.stop();
			return;
		}

		const response = await sb.Got("GenericAPI", {
			url: "https://blog.python.org/feeds/posts/default",
			responseType: "text"
		});

		if (response.statusCode !== 200) {
			return;
		}

		const cacheKey = "python-release-last-publish-date";
		const result = await parseRssNews(response.body, cacheKey);
		if (!result) {
			return;
		}

		const suffix = (result.length === 1) ? "" : "s";
		const message = `New Python version${suffix}! PagChomp 👉 ${result.join(" -- ")}`;
		await handleSubscription("Python", message);
	})
};
