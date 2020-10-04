module.exports = {
	Name: "news",
	Aliases: null,
	Author: "supinic",
	Last_Edit: "2020-10-04T23:04:05.000Z",
	Cooldown: 10000,
	Description: "Fetches short articles. You can use a 2 character ISO code to get country specific news, or any other word as a search query.",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: (() => ({
		extra: {
			exists: async (code) => {
				code = code.toLowerCase();
	
				return Boolean(await sb.Query.getRecordset(rs => rs
					.select("1")
					.from("data", "Extra_News")
					.where("Code = %s", code)
					.single()
				));
			},
	
			fetch: async (code, query) => {
				code = code.toLowerCase();
	
				const row = await sb.Query.getRecordset(rs => rs
					.select("*")
					.from("data", "Extra_News")
					.where("Code = %s", code)
					.single()
				);
	
				if (!row) {
					throw new sb.Error({ message: "Extra news code does not exist!" });
				}
	
				const url = row.URL + sb.Utils.randArray(JSON.parse(row.Endpoints));
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
	Dynamic_Description: async (prefix) => {
		const { sources } = await sb.Got({
			url: "https://newsapi.org/v2/sources",
			headers: {
				Authorization: "Bearer " + sb.Config.get("API_NEWSAPI_ORG")
			}
		}).json();
	
		const extraNews = (await sb.Query.getRecordset(rs => rs
			.select("Code", "Language", "URL", "Helpers")
			.from("data", "Extra_News")
			.orderBy("Code ASC")
		)).map(i => {
			const helpers = i.Helpers ? JSON.parse(i.Helpers).join(", ") : "N/A";
			return `<tr><td>${i.Code.toUpperCase()}</td><td>${sb.Utils.capitalize(i.Language)}</td><td>${helpers}</td></tr>`;
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
			"<ul>" + sources.map(i => `<li><a href="${i.url}">${i.id}</a></li>`).join("") + "</ul>"
		];
	}
};