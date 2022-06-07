const definitions = require("./definitions.json");
const rssCacheKey = "command-news-rss-cache";

module.exports = {
	isCountryCode: (code) => /[A-Z]{2}/.test(code),
	has: (code) => definitions.some(i => i.code === code?.toLowerCase()),
	fetch: async (code, query) => {
		const news = definitions.find(i => i.code === code?.toLowerCase());
		if (!news) {
			throw new sb.Error({ message: "Extra news code does not exist!" });
		}

		const source = sb.Utils.randArray(news.sources);
		const cacheKey = `${rssCacheKey}-${news.code}-${source.name}`;

		let articles = await sb.Cache.get(cacheKey);
		if (!articles) {
			const endpoint = sb.Utils.randArray(source.endpoints);
			const url = [source.url, source.path, endpoint].filter(Boolean).join("/");

			let feed;
			try {
				const xml = await sb.Got(url).text();
				feed = await sb.Utils.parseRSS(xml);
			}
			catch (e) {
				console.warn("RSS news fetch error", e);
				return {
					success: false,
					reply: `Could not fetch any articles due to website error!`
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

		return {
			reply: sb.Utils.fixHTML(sb.Utils.removeHTML(`${title ?? ""}${separator}${content ?? ""} ${delta}`))
		};
	}
};
