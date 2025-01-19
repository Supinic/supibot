export default {
	Name: "news",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches short articles. You can use a 2 uppercase letter code to get country specific news, or any other word as a search query.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [
		{ name: "country", type: "string" },
		{ name: "latest", type: "boolean" },
		{ name: "link", type: "boolean" }
	],
	Whitelist_Response: null,
	Code: (async function news (context, ...args) {
		const rssNews = require("./rss.js");
		const googleNews = require("./google-news.js");

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

			return await rssNews.fetch(context, code, args.join(" "));
		}
		else if (!rssNews.isCountryCode(input)) {
			return await googleNews.fetch(context, args.join(" "));
		}
		else {
			return {
				success: false,
				reply: sb.Utils.tag.trim `
					Your provided country code is currently not supported!
					If you know a good relevant news source with RSS support, you could $suggest it and it would be added.
				`
			};
		}
	}),
	Dynamic_Description: (async function (prefix) {
		const definitions = require("./definitions.json");
		const sorted = [...definitions].sort((a, b) => a.code.localeCompare(b.code));

		const extraNews = sorted.map(def => {
			const { code, language, sources } = def;

			const links = [];
			const helpers = [];
			for (const source of sources) {
				links.push(`<a href="${source.specificMainPageUrl ?? source.url}">${source.name}</a>`);
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
			`Fetches short news articles. Powered by RSS and <a href="https://currentsapi.services/en">CurrentsAPI</a>`,
			"",

			`<code>${prefix}news</code>`,
			"(worldwide news in english)",
			"",

			`<code>${prefix}news (text to search)</code>`,
			`<code>${prefix}news trump</code>`,
			"(worldwide news in English that contain the text you searched for",
			"",

			`<code>${prefix}news <u>(uppercase two-letter country code)</u></code>`,
			`<code>${prefix}news <u>BE</u></code>`,
			"Fetches country-specific news, based on the code provided.",

			`<code>${prefix}news <u>country:(country name or code)</u></code>`,
			`<code>${prefix}news <u>country:BE</u></code>`,
			`<code>${prefix}news <u>country:belgium</u></code>`,
			`<code>${prefix}news <u>country:"united kingdom"</u></code>`,
			"Fetches country-specific news, based on the code/name provided.",
			"",

			`<code>${prefix}news (two-letter country code) <u>(text to search for)</u></code>`,
			`<code>${prefix}news country:(country name or code) <u>(text to search for)</u></code>`,
			`<code>${prefix}news DE </u>berlin</u></code>`,
			`<code>${prefix}news country:czechia </u>prague</u></code>`,
			"Fetches country-specific news that contain the text you searched for.",
			"",

			`<code>${prefix}news <u>(special code)</u></code>`,
			`<code>${prefix}news <u>ONION</u></code>`,
			"Fetches special news, usually from a specific source. Consult the table below.",
			"",

			`<code>${prefix}news (code) <u>latest:true</u></code>`,
			`<code>${prefix}news SK <u>link:true</u></code>`,
			"Fetches the news along with a link to the article, if available.",
			"",

			`<code>${prefix}news (code) <u>link:true</u></code>`,
			`<code>${prefix}news SK <u>link:true</u></code>`,
			"Fetches the news along with a link to the article, if available.",
			"",

			"The following are supported country-specific codes and special codes.",
			`<table><thead><th>Code</th><th>Language</th><th>Sources</th><th>Helpers</th></thead>${extraNews}</table>`,
			""
		];
	})
};
