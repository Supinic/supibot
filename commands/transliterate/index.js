module.exports = {
	Name: "transliterate",
	Aliases: null,
	Author: "supinic",
	Cooldown: 15000,
	Description: "Transliterates non-Latin text into Latin. Should support most of the languages not using Latin (like Japanese, Chinese, Russian, ...)",
	Flags: ["mention","non-nullable","pipe"],
	Params: [
		{ name: "lang", type: "language" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function transliterate (context, ...args) {
		const query = args.join(" ");
		if (!query) {
			return {
				success: false,
				reply: "No input provided!"
			};
		}

		const { lang } = context.params;
		if (!lang) {
			return {
				reply: sb.Utils.transliterate(query)
			};
		}

		const isoCode = lang.getIsoCode(1);
		if (isoCode === "ja") {
			const response = await sb.Got("GenericAPI", {
				url: "https://ichi.moe/cl/qr",
				responseType: "text",
				searchParams: {
					r: "htr",
					q: query
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
		else if (isoCode === "he") {
			const nakdanResponse = await sb.Got("FakeAgent", {
				method: "POST",
				url: "https://nakdan-5-2.loadbalancer.dicta.org.il/api",
				json: {
					data: query,
					useTokenization: true,
					genre: "modern"
				}
			});

			if (!nakdanResponse.ok) {
				return {
					success: false,
					reply: `Could not add niqqud due to external API error!`
				};
			}

			const vocalizedString = nakdanResponse.body.data.map(i => i.nakdan.options[0]?.w ?? i.nakdan.word).join(" ");

			let pageData = await this.getCacheData("page-data");
			if (!pageData) {
				const tokenResponse = await sb.Got("FakeAgent", {
					responseType: "text",
					url: "https://alittlehebrew.com/transliterate/"
				});

				if (!tokenResponse.ok) {
					return {
						success: false,
						reply: `Could not add transliterate due to external API error!`
					};
				}

				const $ = sb.Utils.cheerio(tokenResponse.body);
				const token = $("input[type='hidden']")[0]?.attribs?.value;
				if (!token) {
					return {
						success: false,
						reply: `Could not add transliterate due to missing token!`
					};
				}

				pageData = {
					token,
					cookie: tokenResponse.headers["set-cookie"][0].split(";")[0].split("=")[1]
				};

				await this.setCacheData("page-data", pageData, {
					expiry: 300_000 // 5 minutes
				});
			}

			const transliterateResponse = await sb.Got("FakeAgent", {
				url: "https://alittlehebrew.com/transliterate/get.php",
				headers: {
					"X-Requested-With": "XMLHttpRequest",
					Cookie: `PHPSESSID=${pageData.cookie}`
				},
				searchParams: {
					token: pageData.token,
					style: "000_simple_sefardi",
					syllable: "auto",
					accent: "auto",
					hebrew_text: vocalizedString
				}
			});

			const { result } = transliterateResponse.body;
			if (!result) {
				return {
					success: false,
					reply: `No transliteration was created!`
				};
			}

			return {
				reply: sb.Utils.removeHTML(result)
			};
		}
	}),
	Dynamic_Description: (async (prefix) => [
		`<code>${prefix}transliterate (text)</code>`,
		"Transliterates using automatic character detection. Should work for most non-Latin scripts.",
		"",

		`<code>${prefix}transliterate (text) lang:japanese</code>`,
		`<code>${prefix}transliterate (text) lang:hebrew</code>`,
		"Transliterates more specifically for Japanese/Hebrew.",
		"Only these two languages currently have extended transliteration support.",
		"Disclaimer: Might not always work properly."
	])
};
