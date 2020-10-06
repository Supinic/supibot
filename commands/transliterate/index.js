module.exports = {
	Name: "transliterate",
	Aliases: null,
	Author: "supinic",
	Cooldown: 15000,
	Description: "Transliterates non-latin text into Latin. Should support most of the languages not using Latin (like Japanese, Chinese, Russian, ...)",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function transliterate (context, ...args) {
		if (args.length === 0) {
			return {
				success: false,
				reply: "No input provided!"
			};
		}
	
		const html = await sb.Got({
			url: "https://ichi.moe/cl/qr",
			searchParams: new sb.URLParams()
				.set("r", "htr")
				.set("q", args.join(" "))
				.toString()
		}).text();
	
		const $ = sb.Utils.cheerio(html);
		const words = Array.from($("#div-ichiran-result span.ds-text:not(.hidden) span.ds-word")).map(i => i.firstChild.data);
		if (words.length > 0) {
			return {
				reply: words.join(" ")
			};
		}
	
		return {
			reply: sb.Utils.transliterate(args.join(" "))
		};
	}),
	Dynamic_Description: null
};