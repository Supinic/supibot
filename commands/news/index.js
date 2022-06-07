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
	Static_Data: null,
	Code: (async function news (context, ...args) {
		const rssNews = require("./rss.js");
		const currentsApiNews = require("./currents-api.js");

		let input;
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
			input = args[0];
		}

		if (rssNews.has(input)) {
			const code = (context.params.country)
				? input
				: args.shift();

			return await rssNews.fetch(code, args.join(" "));
		}
		else {
			return await currentsApiNews.fetch(args.join(" "));
		}
	}),
	Dynamic_Description: (async (prefix) => {
		const definitions = require("./definitions.json");
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
