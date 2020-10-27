module.exports = {
	Name: "wiki",
	Aliases: null,
	Author: "supinic",
	Cooldown: 15000,
	Description: "Fetches the headline of the first article found according to user query. Watch out, articles might be case sensitive.",
	Flags: ["mention","pipe","use-params"],
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
		const languageCode = sb.Utils.languageISO.getCode(language)?.toLowerCase();
		if (languageCode === null) {
			return {
				success: false,
				reply: "Invalid language provided!",
				cooldown: { length: 2500 }
			};
		}

		const searchData = await sb.Got({
			url: `https://${languageCode}.wikipedia.org/w/api.php`,
			searchParams: new sb.URLParams()
				.set("format", "json")
				.set("action", "opensearch")
				.set("limit", "1")
				.set("profile", "fuzzy")
				.set("search", args.join(" "))
				.toString()
		}).json();

		if (searchData[1].length === 0) {
			return {
				success: false,
				reply: "No Wiki articles found for your query!"
			};
		}

		const rawData = await sb.Got({
			url: `https://${languageCode}.wikipedia.org/w/api.php`,
			searchParams: new sb.URLParams()
				.set("format", "json")
				.set("action", "query")
				.set("prop", "extracts")
				.set("redirects", "1")
				.set("titles", searchData[1])
				.toString()
		}).json();
	
		const data = rawData.query.pages;
		const key = Object.keys(data)[0];
		if (key === "-1") {
			return {
				success: false,
				reply: "No results found?!"
			};
		}
		else {
			let link = "";
			if (!context.channel || context.channel.Links_Allowed === true) {
				link = `https://${language}.wikipedia.org/?curid=${key}`;
			}

			const { extract, title } = data[key];
			return {
				reply: `${link} ${title}: ${sb.Utils.removeHTML(extract)}`
			};
		}
	}),
	Dynamic_Description: (async (prefix) => {
		return [
			"Finds the summary of a given Wikipedia article.",
			"Watch out - the topic is case sensitive, unfortunately, that's how Wikipedia works, apparently.",
			"",
	
			`<code>${prefix}wiki (topic)</code>`,
			"Posts a link and summary for given wiki topic for English Wikipedia.",
			"",
	
			`<code>${prefix}wiki lang:(language) (topic)</code>`,
			"Posts a link and summary for given wiki topic - but this time, in that language's Wikipedia.",
			"..."
		];
	})
};