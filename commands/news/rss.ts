import * as z from "zod";
import { SupiDate, SupiError } from "supi-core";
import { logger } from "../../singletons/logger.js";
import rawDefinitions from "./definitions.json" with { type: "json" };
import { parseRSS, sanitizeHtmlString } from "../../utils/command-utils.js";
import type { Context, ResultFailure, StrictResult } from "../../classes/command.js";

const rssDefinitionSchema = z.array(z.strictObject({
	code: z.string().lowercase(),
	alternateCodes: z.array(z.string()).optional(),
	language: z.string(),
	sources: z.array(z.strictObject({
		name: z.string(),
		specificMainPageUrl: z.string().optional(),
		url: z.string(),
		path: z.string().nullable(),
		endpoints: z.array(z.string()),
		helpers: z.array(z.string()),
		includeLink: z.boolean().optional()
	}))
}));

const definitions = rssDefinitionSchema.parse(rawDefinitions);
const rssCacheKey = "command-news-rss-cache";

export const isCountryCode = (code: string) => /[A-Z]{2}/.test(code);
export const has = (code: string) => {
	if (!code) {
		return false;
	}

	const lower = code.toLowerCase();
	return definitions.some(i => (
		(i.code === lower || i.alternateCodes?.includes(lower))
		&& (i.sources.length > 0)
	));
};

type Article = {
	title: string;
	content: string | null;
	link: string | null;
	published: number;
};

export const fetch = async (context: Context, code: string, query: string): Promise<ResultFailure | StrictResult> => {
	const lower = code.toLowerCase();
	const news = definitions.find(i => i.code === lower || i.alternateCodes?.includes(lower));
	if (!news) {
		throw new SupiError({ message: "Assert error: Extra news code does not exist" });
	}

	const source = core.Utils.randArray(news.sources);
	const cacheKey = `${rssCacheKey}-${news.code}-${source.name}`;

	let articles = await core.Cache.get(cacheKey) as Article[] | null;
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
			const wrapErr = new SupiError({
				message: "RSS fetching/parsing failed",
				cause: (e instanceof Error) ? e : new Error(String(e))
			});
			void logger.logError("Command", wrapErr, {
				origin: "External",
				context: { code: news.code, url, source }
			});

			return {
				success: false,
				reply: `Could not fetch any articles due to website error! News site: ${source.name}`
			};
		}

		const newArticles = [];
		for (const article of feed.items) {
			if (!article.title) {
				continue;
			}

			newArticles.push({
				title: sanitizeHtmlString(article.title),
				content: (article.content) ? sanitizeHtmlString(article.content.trim()) : null,
				link: article.link ?? null,
				published: new SupiDate(article.pubDate).valueOf()
			});
		}

		articles = newArticles;
		await core.Cache.setByPrefix(cacheKey, articles, { expiry: 36e5 });
	}

	let resultArticles;
	if (query) {
		query = query.toLowerCase();
		resultArticles = articles.filter(i => i.title.toLowerCase().includes(query) || i.content?.toLowerCase().includes(query));
	}
	else {
		resultArticles = articles;
	}

	let article: Article | undefined;
	if (context.params.latest) {
		article = resultArticles.sort((a, b) => b.published - a.published).at(0);
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
	const delta = (published) ? `(published ${core.Utils.timeDelta(new SupiDate(published))})` : "";

	let result;
	const includeLink = context.params.link ?? Boolean(source.includeLink);
	if (!includeLink) {
		result = sanitizeHtmlString(`${title}${separator}${content ?? ""} ${delta}`);
	}
	else {
		const limit = context.channel?.Message_Limit ?? context.platform.messageLimit;
		result = sanitizeHtmlString(`${title}${separator}${content ?? ""} ${link} ${delta}`);

		// If the result is too long at first, skip the article content
		if (result.length >= limit) {
			result = sanitizeHtmlString(`${title} ${link} ${delta}`);
		}

		// If the result is still too long, omit the article text completely and only include the link
		if (result.length >= limit) {
			result = sanitizeHtmlString(`${link} ${delta}`);
		}
	}

	return {
		success: true,
		reply: result
	};
};

let description: string | undefined;
export const getDescription = (): string => {
	if (description) {
		return description;
	}

	const result = [];
	const sortedDefinitions = [...definitions].sort((a, b) => a.code.localeCompare(b.code));
	for (const { code, language, sources } of sortedDefinitions) {
		const links = [];
		const helpers = [];

		for (const source of sources) {
			links.push(`<a href="${source.specificMainPageUrl ?? source.url}">${source.name}</a>`);
			helpers.push(...source.helpers);
		}

		const uniqueHelpers = (helpers.length > 0)
			? [...new Set(helpers)].join(", ")
			: "N/A";

		const rowText = core.Utils.tag.trim `
			<tr>
				<td>${code.toUpperCase()}</td>
				<td>${core.Utils.capitalize(language)}</td>
				<td>${links.join("<br>")}
				<td>${uniqueHelpers}</td>
			</tr>
		`;

		result.push(rowText);
	}

	description = `<table><thead><th>Code</th><th>Language</th><th>Sources</th><th>Helpers</th></thead>${result.join("")}</table>`;
	return description;
};
