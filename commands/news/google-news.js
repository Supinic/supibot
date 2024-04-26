const { parseRSS } = require("../../utils/command-utils.js");

const cleanString = (str) => sb.Utils.fixHTML(sb.Utils.removeHTML(str)).replace(/\s+/g, " ");

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
			title: (i.title) ? cleanString(i.title.trim()) : null,
			content: (i.content) ? cleanString(i.content.trim()) : null,
			published: new sb.Date(i.pubDate).valueOf()
		}));

		const article = sb.Utils.randArray(articles);
		const { content, title, published } = article;
		const separator = (title && content) ? " - " : "";
		const delta = (published)
			? `(published ${sb.Utils.timeDelta(new sb.Date(published))})`
			: "";

		let result;
		const dashlessTitle = title.replace(/-/g, "").replace(/\s+/g, " ");
		if (dashlessTitle.includes(content) || content.includes(dashlessTitle)) {
			result = `${title ?? ""} ${delta}`;
		}
		else {
			result = `${title ?? ""}${separator}${content ?? ""} ${delta}`;
		}

		return {
			reply: result.replace(/\s+/g, " ")
		};
	}
};