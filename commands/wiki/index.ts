import * as z from "zod";
import { SupiError } from "supi-core";
import { declare } from "../../classes/command.js";

const searchSchema = z.tuple([ // For given search term:
	z.string(), // searched term in lowercase
	z.array(z.string()), // related topics
	z.array(z.string()), // empty strings?
	z.array(z.string()) // related topics as links
]);
const articleSchema = z.object({
	query: z.object({
		pages: z.record(z.string(), z.object({
			extract: z.string(),
			ns: z.int(),
			pageid: z.int(),
			title: z.string()
		}))
	})
});
const shortenSchema = z.object({
	shortenurl: z.object({
		shorturl: z.string(),
		shorturlalt: z.string()
	})
});

export default declare({
	Name: "wiki",
	Aliases: null,
	Cooldown: 10000,
	Description: "Fetches the headline of the first article found according to the user query. Watch out, articles might be case-sensitive.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [
		{ name: "lang", type: "language" },
		{ name: "linkOnly", type: "boolean" }
	],
	Whitelist_Response: null,
	Code: (async function wiki (context, ...args) {
		if (args.length === 0) {
			return {
				success: false,
				reply: "No article specified!",
				cooldown: { length: 2500 }
			};
		}

		const languageCode = context.params.lang?.getIsoCode(1) ?? "en";
		let query = args.join(" ");

		if (query.toLowerCase() === "random") {
			const response = await core.Got.get("FakeAgent")({
				url: `https://${languageCode}.wikipedia.org/wiki/Special:Random`,
				responseType: "text"
			});

			if (!response.url) {
				return {
					success: false,
					reply: `Could not find any random articles!`
				};
			}

			const blobs = response.url.split("wiki/");
			query = blobs[1];
		}

		const searchResponse = await core.Got.get("GenericAPI")({
			url: `https://${languageCode}.wikipedia.org/w/api.php`,
			searchParams: {
				format: "json",
				action: "opensearch",
				limit: "10",
				profile: "fuzzy",
				search: query
			}
		});

		const searchData = searchSchema.parse(searchResponse.body);
		if (searchData[1].length === 0) {
			return {
				success: false,
				reply: "No Wiki articles found for your query!"
			};
		}

		const response = await core.Got.get("GenericAPI")({
			url: `https://${languageCode}.wikipedia.org/w/api.php`,
			searchParams: {
				format: "json",
				action: "query",
				prop: "extracts",
				redirects: "1",
				exintro: "0",
				explaintext: "0",
				titles: searchData[1][0]
			}
		});

		const data = articleSchema.parse(response.body).query.pages;
		const key = Object.keys(data)[0];
		if (key === "-1") {
			throw new SupiError({
				message: "Assert error: Wiki provides no result despite providing a search title",
				args: { data, searchData }
			});
		}

		const idLink = `https://${languageCode}.wikipedia.org/?curid=${key}`;
		const params = new URLSearchParams([
			["action", "shortenurl"],
			["format", "json"],
			["url", idLink]
		]);

		const shortenResponse = await core.Got.get("GenericAPI")({
			method: "POST",
			responseType: "json",
			url: "https://meta.wikimedia.org/w/api.php",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded"
			},
			body: params.toString()
		});

		let link = idLink;
		if (shortenResponse.statusCode === 200) {
			const shortenData = shortenSchema.parse(shortenResponse.body);
			link = shortenData.shortenurl.shorturl;
		}

		if (context.params.linkOnly) {
			return {
				success: true,
				reply: link
			};
		}

		const { extract, title } = data[key];
		return {
			success: true,
			reply: `${link} ${title}: ${core.Utils.wrapString(extract, 500)}`
		};
	}),
	Dynamic_Description: (prefix) => [
		"Finds the summary of a given Wikipedia article.",
		"Watch out - the topic is case sensitive, unfortunately, that's how Wikipedia works, apparently.",
		"",

		`<code>${prefix}wiki (topic)</code>`,
		"Posts a link and summary for given wiki topic for English Wikipedia.",
		"",

		`<code>${prefix}wiki lang:(language) (topic)</code>`,
		"Posts a link and summary for given wiki topic - but this time, in that language's Wikipedia.",
		"",

		`<code>${prefix}wiki linkOnly:true (topic)</code>`,
		"Only posts the link for the given wiki topic.",
		"",

		`<code>${prefix}wiki random (topic)</code>`,
		`<code>${prefix}wiki lang:pl random (topic)</code>`,
		"Posts a completely random article, using the Wikipedia <code>Special:Random</code> article.",
		"Also supports specifiying languages."
	]
});
