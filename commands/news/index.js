module.exports = {
	Name: "news",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches short articles. You can use a 2 character ISO code to get country specific news, or any other word as a search query.",
	Flags: ["mention","non-nullable","pipe","use-params"],
	Params: [
		{ name: "country", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: (command => {
		const path = require.resolve("./definitions.json");
		delete require.cache[path];

		const definitions = require("./definitions.json");
		return {
			definitions,
			codeRegex: /^[a-z]{2}$/i,
			extra: {
				exists: (code) => definitions.some(i => i.code === code.toLowerCase()),

				fetch: async (code, query) => {
					const news = definitions.find(i => i.code === code.toLowerCase());
					if (!news) {
						throw new sb.Error({ message: "Extra news code does not exist!" });
					}

					const source = sb.Utils.randArray(news.sources);
					const cacheKey = `${news.code}-${source.name}`;

					let cacheExists = true;
					let articles = await sb.Cache.getByPrefix(command.getCacheKey(), { keys: { cacheKey } });
					if (!articles) {
						cacheExists = false;

						const endpoint = sb.Utils.randArray(source.endpoints);
						const url = [source.url, source.path, endpoint].filter(Boolean)
							.join("/");

						const xml = await sb.Got(url)
							.text();
						const feed = await sb.Utils.parseRSS(xml);

						articles = feed.items.map(i => ({
							title: (i.title) ? i.title.trim() : null,
							content: (i.content) ? i.content.trim() : null,
							link: i.link || i.url,
							published: new sb.Date(i.pubDate).valueOf()
						}));
					}

					if (!cacheExists) {
						await sb.Cache.setByPrefix(command.getCacheKey(), articles, {
							keys: { cacheKey },
							expiry: 36e5
						});
					}

					if (query) {
						query = query.toLowerCase();

						const filteredArticles = articles.filter(i => (
							(i.title?.toLowerCase()
								.includes(query))
							|| (i.content?.toLowerCase()
								.includes(query))
						));

						return sb.Utils.randArray(filteredArticles);
					}
					else {
						return sb.Utils.randArray(articles);
					}
				}
			}
		};
	}),
	Code: (async function news (context, ...rest) {
		const { codeRegex, extra } = this.staticData;
		let input = context.params.country ?? rest[0];
		if (context.params.country) {
			const value = context.params.country;
			const code = await sb.Query.getRecordset(rs => rs
				.select("Code_Alpha_2 AS Code")
				.from("data", "Country")
				.where("Name = %s OR Code_Alpha_2 = %s OR Code_Alpha_3 = %s", value, value, value)
				.single()
				.flat("Code")
			);

			if (!code) {
				return {
					success: false,
					reply: `No country found for your input!`
				};
			}

			input = code;
		}
		else {
			input = rest[0];
		}

		if (input && extra.exists(input)) {
			const code = (context.params.country)
				? input
				: rest.shift();

			let article;
			try {
				article = await extra.fetch(code, rest.join(" ") || null);
			}
			catch (e) {
				console.warn(e);
				return {
					success: false,
					reply: `Could not fetch any articles due to website error!`
				};
			}

			if (!article) {
				return {
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

		let availableLanguages = await sb.Cache.getByPrefix(this);
		if (!availableLanguages) {
			const { languages } = await sb.Got("GenericAPI", {
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
			const languageDescriptor = sb.Utils.modules.languageISO.get(rest[0]);
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

		let response;
		try {
			response = await sb.Got("GenericAPI", {
				url: "https://api.currentsapi.services/v1/search",
				searchParams: params.toString(),
				headers: {
					Authorization: sb.Config.get("API_CURRENTSAPI_TOKEN")
				},
				throwHttpErros: false,
				responseType: "json",
				retry: 0,
				timeout: 2500
			});
		}
		catch (e) {
			if (e instanceof sb.Got.TimeoutError || e instanceof sb.errors.GenericRequestError) {
				return {
					success: false,
					reply: "No relevant news articles found!"
				};
			}
			else {
				throw e;
			}
		}

		const { news } = response.body;
		if (!news) {
			return {
				success: false,
				reply: "No news data returned!"
			};
		}
		else if (news.length === 0) {
			return {
				success: false,
				reply: "No relevant articles found!"
			};
		}

		const { description = "", published, title } = sb.Utils.randArray(news);
		const separator = (title && description) ? " - " : "";
		const delta = (published)
			? `(published ${sb.Utils.timeDelta(new sb.Date(published))})`
			: "";

		return {
			reply: sb.Utils.removeHTML(`${title}${separator}${description} ${delta}`)
		};
	}),
	Dynamic_Description: (async (prefix, values) => {
		const { definitions } = values.getStaticData();
		const sorted = [...definitions].sort((a, b) => a.code.localeCompare(b.code));

		const extraNews = sorted.map(def => {
			const { code, language, sources } = def;

			const links = [];
			const helpers = [];
			for (const source of sources) {
				links.push(`<a href="${source.url}">${source.name}</a>`);
				helpers.push(...source.helpers);
			}

			const uniqueHelpers = (helpers.length > 0)
				? [...new Set(helpers)].join(", ")
				: "N/A";

			return sb.Utils.tag.trim `
				<tr>
					<td>${code.toUpperCase()}</td>
					<td>${sb.Utils.capitalize(language)}</td>
					<td>${links.join("<br>")}
					<td>${uniqueHelpers}</td>
				</tr>
			`;
		}).join("");

		return [
			`Fetches short news articles. Powered by <a href="https://currentsapi.services/en">CurrentsAPI</a>`,
			"",

			`<code>${prefix}news</code>`,
			"(worldwide news in english)",
			"",

			`<code>${prefix}news (text to search)</code>`,
			"(worldwide news in english, that contain the text you searched for",
			"",


			`<code>${prefix}news (two-letter country code)</code>`,
			`<code>${prefix}news <u>country:(country code)</u></code>`,
			`<code>${prefix}news <u>country:(country name)</u></code>`,
			`<code>${prefix}news <u>country:belgium</u></code>`,
			`<code>${prefix}news <u>country:"united kingdom"</u></code>`,
			"(country-specific news)",
			"",
			"(country-specific news)",
			"",

			`<code>${prefix}news (two-letter country code) (text to search for)</code>`,
			"(country-specific news that contain the text you searched for)",
			"",

			`<code>${prefix}news (special combination)</code>`,
			"(special news, usually country-specific. consult table below)",
			"",

			"The following are special codes. Those were often 'helped' by people.",
			`<table><thead><th>Code</th><th>Language</th><th>Sources</th><th>Helpers</th></thead>${extraNews}</table>`,
			""
		];
	})
};
