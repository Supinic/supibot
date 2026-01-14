import { SupiDate, SupiError } from "supi-core";
import { parseRSS } from "../../utils/command-utils.js";

import definitions from "./definitions.json" with { type: "json" };
const rssCacheKey = "command-news-rss-cache";

const sanitize = (string) => core.Utils.fixHTML(core.Utils.removeHTML(string)).replaceAll(/\s+/g, " ");

export default {
	isCountryCode: (code) => /[A-Z]{2}/.test(code),
	has: (code) => {
		if (!code) {
			return false;
		}

		const lower = code.toLowerCase();
		return definitions.some(i => (
			(i.code === lower || i.alternateCodes?.includes(lower))
			&& (i.sources.length > 0)
		));
	},
	fetch: async (context, code, query) => {
		if (!code) {
			throw new SupiError({ message: "No code provided" });
		}

		const lower = code.toLowerCase();
		const news = definitions.find(i => i.code === lower || i.alternateCodes?.includes(lower));
		if (!news) {
			throw new SupiError({ message: "Extra news code does not exist" });
		}

		const source = core.Utils.randArray(news.sources);
		const cacheKey = `${rssCacheKey}-${news.code}-${source.name}`;

		let articles = await core.Cache.get(cacheKey);
		if (!articles) {
			const endpoint = core.Utils.randArray(source.endpoints);
			const url = [source.url, source.path, endpoint].filter(Boolean).join("/");

			let feed;
			try {
				const xml = await core.Got.get("GenericAPI")({
					url,
					headers: {
						"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/602.1 (KHTML, like Gecko) QuiteRss/0.19.4 Version/10.0 Safari/602.1"
					},
					responseType: "text"
				}).text();

				feed = await parseRSS(xml);
			}
			catch (e) {
				const err = new SupiError({
					message: "RSS fetching/parsing failed",
					cause: e
				});

				await sb.Logger.logError("Command", err, {
					origin: "Internal",
					context: {
						code: news.code,
						url,
						source
					}
				});

				return {
					success: false,
					reply: `Could not fetch any articles due to website error! News site: ${source.name}`
				};
			}

			articles = feed.items.map(i => ({
				title: (i.title) ? i.title.trim() : null,
				content: (i.content) ? i.content.trim() : null,
				link: i.link || i.url,
				published: new SupiDate(i.pubDate).valueOf()
			}));

			await core.Cache.set({
				key: cacheKey,
				value: articles,
				expiry: 36e5
			});
		}

		let resultArticles;
		if (query) {
			query = query.toLowerCase();

			resultArticles = articles.filter(i => (
				(i.title?.toLowerCase().includes(query))
				|| (i.content?.toLowerCase().includes(query))
			));
		}
		else {
			resultArticles = articles;
		}

		let article;
		if (context.params.latest) {
			article = resultArticles.sort((a, b) => b.published - a.published)[0];
		}
		else {
			article = core.Utils.randArray(resultArticles);
		}

		if (!article) {
			return {
				success: false,
				reply: "No relevant articles found!"
			};
		}

		const { content, title, published, link } = article;
		const separator = (title && content) ? " - " : "";
		const includeLink = context.params.link ?? Boolean(source.includeLink);

		const delta = (published)
			? `(published ${core.Utils.timeDelta(new SupiDate(published))})`
			: "";

		let result;
		if (!includeLink) {
			result = sanitize(`${title ?? ""}${separator}${content ?? ""} ${delta}`);
		}
		else {
			const limit = context.channel.Message_Limit ?? context.platform.messageLimit;
			result = sanitize(`${title ?? ""}${separator}${content ?? ""} ${link} ${delta}`);

			// If the result is too long at first, skip the article content
			if (result.length >= limit) {
				result = sanitize(`${title ?? ""} ${link} ${delta}`);
			}

			// If the result is still too long, omit the article text completely and only include the link
			if (result.length >= limit) {
				result = sanitize(`${link} ${delta}`);
			}
		}

		return {
			reply: result
		};
	}
};
