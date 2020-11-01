module.exports = {
	Name: "news",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches short articles. You can use a 2 character ISO code to get country specific news, or any other word as a search query.",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: (() => ({
		codeRegex: /[a-z]{2}/i,

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
		const { codeRegex, extra } = this.staticData;
		if (rest[0] && extra.exists(rest[0])) {
			const code = rest.shift();
			const article = await extra.fetch(code, rest.join(" ") || null);
	
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

		let availableLanguages = await sb.Cache.getByPrefix(this);
		if (!availableLanguages) {
			const { languages } = await sb.Got({
				url: "https://api.currentsapi.services/v1/available/languages",
				headers: {
					Authorization: sb.Config.get("API_CURRENTSAPI_TOKEN")
				},
				responseType: "json"
			}).json();

			availableLanguages = Object.keys(languages).map(i => i.toLowerCase());
			await sb.Cache.setByPrefix(this, availableLanguages, {
				expiry: 7 * 864e5
			});
		}

		const params = new sb.URLParams();
		if (rest[0] && codeRegex.test(rest[0])) {
			const languageDescriptor = sb.Utils.languageISO.get(rest[0]);
			if (!languageDescriptor) {
				return {
					success: false,
					reply: "Provided language does not exist!"
				};
			}

			const languageName = languageDescriptor.names[0];
			if (!availableLanguages.includes(languageName)) {
				return {
					success: false,
					reply: "Provided language is not supported!"
				};
			}

			rest.splice(0, 1);
			params.set("language", languageDescriptor.iso6391);
		}
		else {
			params.set("language", "en");
		}

		if (rest.length > 0) {
			params.set("keywords", rest.join(" "));
		}

		const { statusCode, body: data } = await sb.Got({
			url: "https://api.currentsapi.services/v1/search",
			searchParams: params.toString(),
			headers: {
				Authorization: sb.Config.get("API_CURRENTSAPI_TOKEN")
			},
			throwHttpErros: false,
			responseType: "json"
		});

		if (statusCode !== 200) {
			throw new sb.errors.APIError({
				statusCode,
				reason: data?.message ?? null,
				apiName: "CurrentsAPI"
			}); 
		}

		const { news } = data;
		if (!news) {
			return {
				reply: "No news data returned!"
			};
		}
		else if (news.length === 0) {
			return {
				reply: "No relevant articles found!"
			};
		}
	
		const { description, published, title } = sb.Utils.randArray(data.articles);
		const delta = (published)
			? "(published " + sb.Utils.timeDelta(new sb.Date(published)) + ")"
			: "";
	
		return {
			reply: sb.Utils.removeHTML(`${title} ${description ?? ""} ${delta}`)
		};
	}),
	Dynamic_Description: (async (prefix, values) => {
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
	
			`<code>${prefix}news (two-letter country code) (text to search for)</code>`,
			"(country-specific news that contain the text you searched for)",
			"",
	
			`<code>${prefix}news (special combination)</code>`,
			"(special news, usually country-specific. consult table below)",
			"",
	
			"The following are special codes. Those were often 'helped' by people.",
			"<table><thead><th>Code</th><th>Language</th><th>Helpers</th></thead>" + extraNews + "</table>",
			""
		];
	})
};