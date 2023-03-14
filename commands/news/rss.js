const definitions = require("./definitions.json");
const rssCacheKey = "command-news-rss-cache";

module.exports = {
	isCountryCode: (code) => /[A-Z]{2}/.test(code),
	has: (code) => {
		if (!code) {
			return false;
		}

		const lower = code.toLowerCase();
		return definitions.some(i => i.code === lower || i.alternateCodes?.includes(lower));
	},
	fetch: async (code, query) => {
		if (!code) {
			throw new sb.Error({ message: "No code provided" });
		}

		const lower = code.toLowerCase();
		const news = definitions.find(i => i.code === lower || i.alternateCodes?.includes(lower));
		if (!news) {
			throw new sb.Error({ message: "Extra news code does not exist" });
		}

		const source = sb.Utils.randArray(news.sources);
		const cacheKey = `${rssCacheKey}-${news.code}-${source.name}`;

		let articles = await sb.Cache.get(cacheKey);
		if (!articles) {
			const endpoint = sb.Utils.randArray(source.endpoints);
			const url = [source.url, source.path, endpoint].filter(Boolean).join("/");

			let feed;
			try {
				const xml = await sb.Got("Global", url).text();
				feed = await sb.Utils.parseRSS(xml);
			}
			catch (e) {
				await sb.Logger.logError("Command", e, {
					origin: "Internal",
					message: "RSS fetching/parsing failed",
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
				published: new sb.Date(i.pubDate).valueOf()
			}));

			await sb.Cache.set({
				key: cacheKey,
				value: articles,
				expiry: 36e5
			});
		}

		let article;
		if (query) {
			query = query.toLowerCase();

			const filteredArticles = articles.filter(i => (
				(i.title?.toLowerCase().includes(query))
				|| (i.content?.toLowerCase().includes(query))
			));

			article = sb.Utils.randArray(filteredArticles);
		}
		else {
			article = sb.Utils.randArray(articles);
		}

		if (!article) {
			return {
				success: false,
				reply: "No relevant articles found!"
			};
		}

		const { content, title, published } = article;
		const separator = (title && content) ? " - " : "";
		const delta = (published)
			? `(published ${sb.Utils.timeDelta(new sb.Date(published))})`
			: "";

		const result = sb.Utils.fixHTML(sb.Utils.removeHTML(`${title ?? ""}${separator}${content ?? ""} ${delta}`));
		return {
			reply: result.replace(/\s+/g, " ")
		};
	}
};
