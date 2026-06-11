import { SupiDate } from "supi-core";
import { parseRSS, sanitizeHtmlString } from "../../utils/command-utils.js";
import type { ResultFailure, StrictResult } from "../../classes/command.js";
import type { NewsOptions } from "./news-helpers.js";

export const fetchGoogleNews = async (options: NewsOptions, query?: string): Promise<ResultFailure | StrictResult> => {
	if (options.params.link) {
		return {
			success: false,
			reply: `Links are only available for code-specific news!`
		};
	}

	let response;
	if (query) {
		response = await core.Got.get("GenericAPI")({
			url: "https://news.google.com/rss/search",
			responseType: "text",
			searchParams: {
				hl: "en-US",
				q: query,
				gl: "US",
				ceid: "US:en"
			}
		});
	}
	else {
		response = await core.Got.get("GenericAPI")({
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

	const articles = [];
	for (const article of rss.items) {
		if (typeof article.title !== "string" || article.content !== "string") {
			continue;
		}

		articles.push({
			title: sanitizeHtmlString(article.title.trim()),
			content: sanitizeHtmlString(article.content.trim()),
			published: new SupiDate(article.pubDate).valueOf()
		});
	}

	const article = (options.params.latest)
		? articles.sort((a, b) => b.published - a.published)[0]
		: core.Utils.randArray(articles);

	const { content, title, published } = article;
	const separator = (title && content) ? " - " : "";
	const delta = `(published ${core.Utils.timeDelta(new SupiDate(published))})`;

	let result;
	const dashlessTitle = title.replaceAll("-", "").replaceAll(/\s+/g, " ");
	const dashlessContent = content.replaceAll("-", "").replaceAll(/\s+/g, " ");

	if (dashlessTitle.includes(dashlessContent)) {
		result = `${title} ${delta}`;
	}
	else if (dashlessContent.includes(dashlessTitle)) {
		result = `${content} ${delta}`;
	}
	else {
		result = `${title}${separator}${content} ${delta}`;
	}

	return {
		success: true,
		reply: result.replaceAll(/\s+/g, " ")
	};
};
