const { parseRSS } = require("../../utils/command-utils.js");

const cleanString = (str) => sb.Utils.fixHTML(sb.Utils.removeHTML(str)).replaceAll(/\s+/g, " ");

module.exports = {
	fetch: async (context, query) => {
		if (context.params.link) {
			return {
				success: false,
				reply: `Links are only available for code-specific news!`
			};
		}

		let response;
		if (query) {
			response = await sb.Got.get("GenericAPI")({
				url: "https://news.google.com/rss/search",
				responseType: "text",
				searchParams: {
					hl: "en-US",
					q: query ?? "e", // The letter "E" is the most common letter in the English language
					gl: "US",
					ceid: "US:en"
				}
			});
		}
		else {
			response = await sb.Got.get("GenericAPI")({
				url: "https://news.google.com/rss",
				responseType: "text"
			});
		}

		const xml = response.body;
		const rss = await parseRSS(xml);
		if (rss.items.length === 0) {
			return {
				success: false,
				reply: `No news found for your query!`
			};
		}

		const articles = rss.items.map(i => ({
			title: (i.title) ? cleanString(i.title.trim()) : null,
			content: (i.content) ? cleanString(i.content.trim()) : null,
			published: new sb.Date(i.pubDate).valueOf()
		}));

		const article = (context.params.latest)
			? articles.sort((a, b) => b.published - a.published)[0]
			: sb.Utils.randArray(articles);

		const { content, title, published } = article;
		const separator = (title && content) ? " - " : "";
		const delta = (published)
			? `(published ${sb.Utils.timeDelta(new sb.Date(published))})`
			: "";

		let result;
		const dashlessTitle = title.replaceAll("-", "").replaceAll(/\s+/g, " ");
		if (dashlessTitle.includes(content) || content.includes(dashlessTitle)) {
			result = `${title ?? ""} ${delta}`;
		}
		else {
			result = `${title ?? ""}${separator}${content ?? ""} ${delta}`;
		}

		return {
			reply: result.replaceAll(/\s+/g, " ")
		};
	}
};
