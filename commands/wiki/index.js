module.exports = {
	Name: "wiki",
	Aliases: null,
	Author: "supinic",
	Cooldown: 15000,
	Description: "Fetches the headline of the first article found according to user query. Watch out, articles might be case sensitive.",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function wiki (context, ...args) {
		if (args.length === 0) {
			return {
				reply: "No article specified!",
				cooldown: { length: 2500 }
			};
		}
	
		let language = "en";
		for (let i = args.length - 1; i >= 0; i--) {
			const token = args[i];
			if (/lang:\w+/.test(token)) {
				language = sb.Utils.languageISO.getCode(token.split(":")[1]);
				if (language === null) {
					return {
						reply: "Invalid language provided!",
						cooldown: { length: 1000 }
					};
				}
	
				language = language.toLowerCase();
				args.splice(i, 1);
			}
		}
	
		const query = args.join(" ").split(/(?:(\W))/).filter(Boolean).map(i => i[0].toUpperCase() + i.slice(1)).join("");
		const rawData = await sb.Got({
			url: `https://${language}.wikipedia.org/w/api.php`,
			searchParams: new sb.URLParams()
				.set("format", "json")
				.set("action", "query")
				.set("prop", "extracts")
				.set("redirects", "1")
				.set("titles", query)
				.toString()
		}).json();
	
		const data = rawData.query.pages;
		const key = Object.keys(data)[0];
		if (key === "-1") {
			return { reply: "No results found!" };
		}
		else {
			let link = "";
			if (!context.channel || context.channel.Links_Allowed === true) {
				link = `https://${language}.wikipedia.org/?curid=${key}`;
			}
	
			return {
				reply: link + " " + data[key].title + ": " + sb.Utils.removeHTML(data[key].extract)
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