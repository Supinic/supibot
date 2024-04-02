const { parseRSS } = require("../../utils/command-utils.js");

module.exports = {
	fetch: async (query) => {
		const searchParams = {
			hl: "en-US",
			q: query ?? "e", // The letter "E" is the most common letter in the English language
			gl: "US",
			ceid: "US:en"
		};

		const response = await sb.Got("GenericAPI", {
			url: "https://news.google.com/rss/search",
			searchParams,
			responseType: "text"
		});

		const xml = response.body;
		const rss = await parseRSS(xml);

		const articles = rss.items.map(i => ({
			title: (i.title) ? i.title.trim() : null,
			content: (i.content) ? i.content.trim() : null,
			published: new sb.Date(i.pubDate).valueOf()
		}));

		const article = sb.Utils.randArray(articles);
		const { content, title, published } = article;
		const separator = (title && content) ? " - " : "";
		const delta = (published)
			? `(published ${sb.Utils.timeDelta(new sb.Date(published))})`
			: "";

		let result;
		if (title.includes(content) || content.includes(title)) {
			result = `${content ?? ""} ${delta}`;
		}
		else {
			result = `${title ?? ""}${separator}${content ?? ""} ${delta}`;
		}

		result = sb.Utils.fixHTML(sb.Utils.removeHTML(result));
		return {
			reply: result.replace(/\s+/g, " ")
		};
	}
};
