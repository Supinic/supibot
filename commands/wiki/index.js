module.exports = {
	Name: "wiki",
	Aliases: null,
	Author: "supinic",
	Cooldown: 15000,
	Description: "Fetches the headline of the first article found according to user query. Watch out, articles might be case sensitive.",
	Flags: ["mention","non-nullable","pipe","use-params"],
	Params: [
		{ name: "lang", type: "string" },
		{ name: "language", type: "string" },
		{ name: "linkOnly", type: "boolean" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function wiki (context, ...args) {
		if (args.length === 0) {
			return {
				success: false,
				reply: "No article specified!",
				cooldown: { length: 2500 }
			};
		}

		const language = context.params.lang ?? context.params.language ?? "english";
		const languageCode = sb.Utils.modules.languageISO.getCode(language)?.toLowerCase();
		if (!languageCode) {
			return {
				success: false,
				reply: "Invalid language provided!",
				cooldown: { length: 2500 }
			};
		}

		const searchData = await sb.Got("GenericAPI", {
			url: `https://${languageCode}.wikipedia.org/w/api.php`,
			searchParams: {
				format: "json",
				action: "opensearch",
				limit: "10",
				profile: "fuzzy",
				search: args.join(" ")
			}
		});

		if (searchData[1].body.length === 0) {
			return {
				success: false,
				reply: "No Wiki articles found for your query!"
			};
		}

		const response = await sb.Got("GenericAPI", {
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

		const data = response.body.query.pages;
		const key = Object.keys(data)[0];
		if (key === "-1") {
			return {
				success: false,
				reply: "No results found?!"
			};
		}
		else {
			const link = `https://${languageCode}.wikipedia.org/?curid=${key}`;
			if (context.params.linkOnly) {
				return {
					reply: link
				};
			}

			const { extract, title } = data[key];
			return {
				reply: `${link} ${title}: ${sb.Utils.wrapString(extract, 1000)}`
			};
		}
	}),
	Dynamic_Description: (async (prefix) => [
		"Finds the summary of a given Wikipedia article.",
		"Watch out - the topic is case sensitive, unfortunately, that's how Wikipedia works, apparently.",
		"",

		`<code>${prefix}wiki (topic)</code>`,
		"Posts a link and summary for given wiki topic for English Wikipedia.",
		"",

		`<code>${prefix}wiki lang:(language) (topic)</code>`,
		"Posts a link and summary for given wiki topic - but this time, in that language's Wikipedia.",
		"...",

		`<code>${prefix}wiki linkOnly:true (topic)</code>`,
		"Only posts the link for the given wiki topic.",
		"..."
	])
};
