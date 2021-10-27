module.exports = {
	Name: "transliterate",
	Aliases: null,
	Author: "supinic",
	Cooldown: 15000,
	Description: "Transliterates non-latin text into Latin. Should support most of the languages not using Latin (like Japanese, Chinese, Russian, ...)",
	Flags: ["mention","non-nullable","pipe","use-params"],
	Params: [
		{ name: "japaneseOnly", type: "boolean" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function transliterate (context, ...args) {
		if (args.length === 0) {
			return {
				success: false,
				reply: "No input provided!"
			};
		}

		if (context.params.japaneseOnly) {
			const response = await sb.Got("GenericAPI", {
				url: "https://ichi.moe/cl/qr",
				searchParams: {
					r: "htr",
					q: args.join(" ")
				}
			});

			const html = response.body;
			const $ = sb.Utils.cheerio(html);
			const words = Array.from($("#div-ichiran-result span.ds-text:not(.hidden) span.ds-word")).map(i => i.firstChild.data);

			if (words.length > 0) {
				return {
					reply: words.join(" ")
				};
			}
			else {
				return {
					success: false,
					reply: `Could not tranlsliterate specifically from Japanese!`
				};
			}
		}

		return {
			reply: sb.Utils.transliterate(args.join(" "))
		};
	}),
	Dynamic_Description: (async (prefix) => [
		`<code>${prefix}transliterate (text)</code>`,
		"Transliterates using automatic character detection. Should work for most non-Latin scripts.",
		"",

		`<code>${prefix}transliterate (text) japaneseOnly:true</code>`,
		"Transliterates using a website specifically made to transliterate Japanese text only.",
		"Might not always work."
	])
};
