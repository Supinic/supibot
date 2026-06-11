import { SupiError } from "supi-core";
import * as Rss from "./rss.js";
import { fetchGoogleNews } from "./google-news.js";
import { declare } from "../../classes/command.js";
import { newsParams } from "./news-helpers.js";

const newsCommandDefinition = declare({
	Name: "news",
	Aliases: null,
	Cooldown: 10000,
	Description: "Fetches short articles. You can use a 2 uppercase letter code to get country specific news, or any other word as a search query.",
	Flags: ["mention", "non-nullable", "pipe"],
	Params: newsParams,
	Whitelist_Response: null,
	Code: (async function news (context, ...args) {
		let input: string;
		if (context.params.country) {
			const value = context.params.country;
			const code = await core.Query.getRecordset<string | undefined>(rs => rs
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

		const options = {
			params: context.params,
			limit: context.messageLimit
		};

		if (Rss.has(input)) {
			const code = (context.params.country) ? input : args.shift();
			if (!code) {
				throw new SupiError({
					message: "Assert error: Could not get extra news code"
				});
			}

			return await Rss.fetch(options, code, args.join(" "));
		}
		else {
			return await fetchGoogleNews(options, args.join(" "));
		}
	}),
	Dynamic_Description: (prefix) => [
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
		Rss.getDescription(),
		""
	]
});

export default newsCommandDefinition;
