module.exports = {
	Name: "news",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches short articles. You can use a 2 character ISO code to get country specific news, or any other word as a search query.",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: (() => ({
		definitions: [
			{
				code: "fi",
				language: "finnish",
				url: "https://high.fi/kotimaa/",
				endpoints: [
					"rss"
				],
				type: "RSS",
				helpers: ["kalastelija01", "leppunen"]
			},
			{
				code: "vn",
				language: "vietnamese",
				url: "https://vietnamnet.vn/rss/",
				endpoints: [
					"thoi-su.rss",
					"tuanvietnam.rss"
				],
				type: "RSS",
				helpers: ["supinic"]
			},
			{
				code: "ug",
				language: "swahili",
				url: "https://www.bukedde.co.ug/feed/rss/category/",
				endpoints: [
					"ssanyu"
				],
				type: "RSS",
				helpers: ["supinic"]
			},
			{
				code: "es",
				language: "spanish",
				url: "https://www.abc.es/rss/feeds/abc",
				endpoints: [
					"_Economia.xml",
					"_opinioncompleto.xml",
					"_Cultura.xml",
					"_EspanaEspana.xml",
					"Portada.xml"
				],
				type: "RSS",
				helpers: ["(unknown guy from nymns chat)"]
			},
			{
				code: "cl",
				language: "spanish",
				url: "https://www.cooperativa.cl/noticias/site/tax/port/",
				endpoints: [
					"all/rss____1.xml"
				],
				type: "RSS",
				helpers: ["namtheweebs"]
			},
			{
				code: "is",
				language: "icelandic",
				url: "https://www.ruv.is/rss/",
				endpoints: [
					"frettir",
					"innlent",
					"erlent"
				],
				type: "RSS",
				helpers: ["kawaqa"]
			},
			{
				code: "rs",
				language: "serbian",
				url: "http://rs.n1info.com/rss/",
				endpoints: [
					"249/Naslovna"
				],
				type: "RSS",
				helpers: ["supinic", "infinitegachi"]
			},
			{
				code: "dk",
				language: "danish",
				url: "https://ekstrabladet.dk/rssfeed/",
				endpoints: [
					"all",
					"nyheder"
				],
				type: "RSS",
				helpers: ["gubbyfish"]
			},
			{
				code: "et",
				language: "estonian",
				url: "https://www.postimees.ee/",
				endpoints: [
					"rss"
				],
				type: "RSS",
				helpers: ["slordniir"]
			},
			{
				code: "mt",
				language: "maltese",
				url: "https://www.tvm.com.mt/mt/",
				endpoints: [
					"feed"
				],
				type: "RSS",
				helpers: ["trollpotat0"]
			},
			{
				code: "by",
				language: "belarusian",
				url: "https://charter97.org/be/rss/",
				endpoints: [
					"all"
				],
				type: "RSS",
				helpers: ["karylul", "gw_ua"]
			},
			{
				code: "hr",
				language: "croatian",
				url: "https://www.index.hr/rss/",
				endpoints: [
					"vijesti",
					"vijesti-hrvatska"
				],
				type: "RSS",
				helpers: ["lordborne"]
			},
			{
				code: "onion",
				language: "english",
				url: "https://www.theonion.com/",
				endpoints: [
					"rss"
				],
				type: "RSS",
				helpers: ["supinic"]
			},
			{
				code: "vz",
				language: "spanish",
				url: "https://www.voanoticias.com/api/",
				endpoints: [
					"zvirqoeojrqi"
				],
				type: "RSS",
				helpers: []
			},
			{
				code: "vice",
				language: "english",
				url: "https://www.vice.com/en_ca/",
				endpoints: [
					"rss"
				],
				type: "RSS",
				helpers: ["supinic"]
			},
			{
				code: "ch",
				language: "german",
				url: "https://www.nzz.ch/",
				endpoints: [
					"recent.rss",
					"international.rss",
					"schweiz.rss"
				],
				type: "RSS",
				helpers: ["avulsed_"]
			}
		],

		extra: {
			exists: (code) => (
				Boolean(this.staticData.definitions.find(i => i.code === code.toLowerCase()))
			),
	
			fetch: async (code, query) => {
				const news = this.staticData.definitions.find(i => i.code === code.toLowerCase());
				if (!news) {
					throw new sb.Error({ message: "Extra news code does not exist!" });
				}
	
				const url = news.url + sb.Utils.randArray(news.endpoints);
				const feed = await sb.Utils.parseRSS(url);
	
				if (query) {
					query = query.toLowerCase();
					feed.items = feed.items.filter(i => (
						(i.title?.toLowerCase().includes(query))
						|| (i.content?.toLowerCase().includes(query))
					));
				}
	
				const article = sb.Utils.randArray(feed.items);
				if (!article) {
					return null;
				}
	
				return {
					title: article.title,
					content: article.content,
					link: article.link || article.url,
					published: new sb.Date(article.pubDate)
				};
			}
		}
	})),
	Code: (async function news (context, ...rest) {
		const params = new sb.URLParams().set("language", "en");
		if (rest[0] && await this.staticData.extra.exists(rest[0])) {
			const code = rest.shift();
			const article = await this.staticData.extra.fetch(code, rest.join(" ") || null);
	
			if (!article) {
				return {
					reply: "No relevant articles found!"
				};
			}
	
			const { content = "", title, published } = article;
			let delta = "";
			if (published.valueOf()) {
				delta = "(published " + sb.Utils.timeDelta(published) + ")";
			}
	
			return {
				reply: sb.Utils.removeHTML(`${title} ${content ?? ""} ${delta}`)
			};
		}
		else if (/^[A-Z]{2}$/i.test(rest[0])) {
			params.unset("language").set("country", rest.shift().toLowerCase());
		}
		else if (/source:\w+/i.test(rest[0])) {
			params.unset("language").set("sources", rest.shift().split(":")[1]);
		}
	
		if (rest.length !== 0) {
			params.set("q", rest.join(" "));
		}
		else if (!params.has("country") && !params.has("sources")) {
			params.set("country", "US");
		}
	
		const { statusCode, body: data } = await sb.Got({
			url: "https://newsapi.org/v2/top-headlines",
			searchParams: params.toString(),
			throwHttpErrors: false,
			responseType: "json",
			headers: {
				Authorization: "Bearer " + sb.Config.get("API_NEWSAPI_ORG")
			}
		});
	
		if (statusCode !== 200) {
			throw new sb.errors.APIError({
				statusCode,
				reason: data?.message ?? null,
				apiName: "NewsAPI"
			}); 
		}
		else if (!data.articles) {
			return {
				reply: "No news data returned!"
			};
		}
		else if (data.articles.length === 0) {
			return {
				reply: "No relevant articles found!"
			};
		}
	
		const { description, publishedAt, title } = sb.Utils.randArray(data.articles);
		const delta = (publishedAt)
			? "(published " + sb.Utils.timeDelta(new sb.Date(publishedAt)) + ")"
			: "";
	
		return {
			reply: sb.Utils.removeHTML(`${title} ${description ?? ""} ${delta}`)
		};
	}),
	Dynamic_Description: (async (prefix, values) => {
		let data = await sb.Cache.getByPrefix("api-news-sources");
		if (!data) {
			const { statusCode, body: sourcesData } = await sb.Got({
				url: "https://newsapi.org/v2/sources",
				responseType: "json",
				throwHttpErrors: false,
				headers: {
					Authorization: "Bearer " + sb.Config.get("API_NEWSAPI_ORG")
				}
			});

			if (statusCode === 200) {
				const { sources } = sourcesData;
				data = sources;

				await sb.Cache.setByPrefix("api-news-sources", sources, {
					expiry: 24 * 3_600_000
				});
			}
		}

		const sources = (data)
			? "<ul>" + data.map(i => `<li><a href="${i.url}">${i.id}</a></li>`).join("") + "</ul>"
			: "Data sources are not currently available";

		const { definitions } = values.getStaticData();
		const extraNews = definitions.map(i => {
			const helpers = (i.helpers.length > 0) ? i.helpers.join(", ") : "N/A";
			return `<tr><td>${i.code.toUpperCase()}</td><td>${sb.Utils.capitalize(i.language)}</td><td>${helpers}</td></tr>`;
		}).join("");
		
		return [
			"Fetches short news articles.",
			"",
	
			`<code>${prefix}news</code>`,
			"(worldwide news in english)",
			"",
		
			`<code>${prefix}news (text to search)</code>`,
			"(worldwide news in english, that contain the text you searched for",
			"",
			
			`<code>${prefix}news (two-letter country code)</code>`,
			"(country-specific news)",
			"",
	
			`<code>${prefix}news source:(source)</code>`,
			"news from your selected news source. check the list of sources below.",
			"",
	
			`<code>${prefix}news (two-letter country code) (text to search for)</code>`,
			"(country-specific news that contain the text you searched for)",
			"",
	
			`<code>${prefix}news (special combination)</code>`,
			"(special news, usually country-specific. consult table below)",
			"",
	
			"The following are special codes. Those were often 'helped' by people.",
			"<table><thead><th>Code</th><th>Language</th><th>Helpers</th></thead>" + extraNews + "</table>",
			"",
	
			"List of usable sources:",
			sources
		];
	})
};