import * as z from "zod";
import { transliterate as executeGenericTransliteration } from "transliteration";
import { declare, type StrictResult } from "../../classes/command.js";

const nakdanSchema = z.object({
	data: z.array(z.object({
		nakdan: z.object({
			word: z.string(),
			options: z.array(z.object({
				w: z.string().optional()
			}))
		})
	}))
});
const hebrewSchema = z.object({ result: z.string().optional() });

const getHebrewSiteData = async () => {
	type PageData = { token: string; cookie: string; };
	const cacheKey = "alittlehebrew-page-data";

	const cacheData = await core.Cache.getByPrefix(cacheKey) as PageData | undefined;
	if (cacheData) {
		return cacheData;
	}

	const tokenResponse = await core.Got.get("FakeAgent")({
		responseType: "text",
		url: "https://alittlehebrew.com/transliterate/"
	});
	if (!tokenResponse.ok) {
		return {
			success: false,
			reply: "Could not load the Hebrew transliteration website! Try again later."
		};
	}

	const $ = core.Utils.cheerio(tokenResponse.body);
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	const token = $("input[type='hidden']")[0]?.attribs?.value;
	if (!token) {
		return {
			success: false,
			reply: `Could not add transliterate due to missing token!`
		};
	}

	const pageData = {
		token,
		cookie: tokenResponse.headers["set-cookie"]?.[0].split(";")[0].split("=")[1] ?? ""
	};

	await core.Cache.setByPrefix(cacheKey, pageData, {
		expiry: 300_000 // 5 minutes
	});

	return pageData;
};

const transliterateHebrew = async (query: string): Promise<StrictResult> => {
	const nakdanResponse = await core.Got.get("FakeAgent")({
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

	const { data: nakdanData } = nakdanSchema.parse(nakdanResponse.body);
	const vocalizedString = nakdanData.map(i => i.nakdan.options[0]?.w ?? i.nakdan.word).join(" ");

	const pageData = await getHebrewSiteData();
	if ("success" in pageData) {
		return pageData;
	}

	const transliterateResponse = await core.Got.get("FakeAgent")({
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

	const { result } = hebrewSchema.parse(transliterateResponse.body);
	if (!result) {
		return {
			success: false,
			reply: `No transliteration was created!`
		};
	}

	return {
		success: true,
		reply: core.Utils.removeHTML(result)
	};
};

const transliterateJapanese = async (query: string): Promise<StrictResult> => {
	const response = await core.Got.get("GenericAPI")({
		url: "https://ichi.moe/cl/qr",
		responseType: "text",
		searchParams: { r: "htr", q: query }
	});

	const html = response.body;
	const $ = core.Utils.cheerio(html);

	const els = $("#div-ichiran-result span.ds-text:not(.hidden) span.ds-word");
	const words = [...els].map(i => $(i).text().trim());
	if (words.length === 0) {
		return {
			success: false,
			reply: `Could not apply a specific Japanese transliteration! No text has been extracted.`
		};
	}

	return {
		success: true,
		reply: words.join(" ")
	};
};

export default declare({
	Name: "transliterate",
	Aliases: null,
	Cooldown: 10000,
	Description: "Transliterates non-Latin text into Latin. Should support most of the languages not using Latin (like Japanese, Chinese, Russian, ...)",
	Flags: ["mention","non-nullable","pipe"],
	Params: [
		{ name: "lang", type: "language" }
	],
	Whitelist_Response: null,
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
				success: true,
				reply: executeGenericTransliteration(query)
			};
		}

		const isoCode = lang.getIsoCode(1);
		if (isoCode === "ja") {
			return await transliterateJapanese(query);
		}
		else if (isoCode === "he") {
			return await transliterateHebrew(query);
		}
		else {
			return {
				success: false,
				reply: "Specific transliteration for this language is not supported! Remove the `lang` parameter and try the generic transliteration instead."
			};
		}
	}),
	Dynamic_Description: (prefix) => [
		`<code>${prefix}transliterate (text)</code>`,
		"Transliterates using automatic character detection. Should work for most non-Latin scripts.",
		"",

		`<code>${prefix}transliterate (text) lang:japanese</code>`,
		`<code>${prefix}transliterate (text) lang:hebrew</code>`,
		"Transliterates more specifically for Japanese/Hebrew.",
		"Only these two languages currently have extended transliteration support.",
		"Disclaimer: Might not always work properly."
	]
});
