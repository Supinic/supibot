export const definition = {
	Name: "dotnet-news-checker",
	Expression: "0 */5 * * * *",
	Description: "Checks for new .NET devblogs, and posts updates for subscribed users.",
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
			url: "https://devblogs.microsoft.com/dotnet/feed",
			responseType: "text"
		});

		if (response.statusCode !== 200) {
			return;
		}

		const cacheKey = "dotnet-blog-last-publish-date";
		const result = await parseRssNews(response.body, cacheKey);
		if (!result) {
			return;
		}

		const suffix = (result.length === 1) ? "" : "s";
		const message = `New .NET devblog${suffix}! PagChomp 👉 ${result.join(" -- ")}`;
		await handleSubscription(".NET", message);
	})
};
