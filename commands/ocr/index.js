import LanguageCodes from "../../utils/languages.js";
import OCR_LANGUAGES from "./ocr-languages.json" with { type: "json" };
const OCR_LANGUAGE_NAMES = Object.keys(OCR_LANGUAGES).map(i => LanguageCodes.getName(i));

export default {
	Name: "ocr",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Takes your image link and attempts to find the text in it by using OCR.",
	Flags: ["external-input","mention","non-nullable","pipe"],
	Params: [
		{ name: "engine", type: "number" },
		{ name: "force", type: "boolean" },
		{ name: "lang", type: "string" }
	],
	Whitelist_Response: null,
	Code: (async function ocr (context, ...args) {
		if (!process.env.API_OCR_SPACE) {
			throw new sb.Error({
				message: "No OCR Space key configured (API_OCR_SPACE)"
			});
		}

		let languageCode = "eng";
		if (context.params.lang) {
			languageCode = LanguageCodes.getCode(context.params.lang, "iso6393");
			if (!languageCode) {
				return {
					success: false,
					reply: "Provided language could not be parsed!"
				};
			}
		}

		const language = OCR_LANGUAGES[languageCode];
		if (!language) {
			return {
				success: false,
				reply: `Language is not supported! Use one of these: ${OCR_LANGUAGE_NAMES.join(", ")}`,
				cooldown: 2500
			};
		}

		let link;
		for (const arg of args) {
			let parsedURL;
			try {
				parsedURL = new URL(arg);
			}
			catch {
				continue;
			}

			parsedURL.protocol = "https";
			link = parsedURL.toString();

			break;
		}

		if (!link) {
			return {
				success: false,
				reply: "No valid link provided!",
				cooldown: 2500
			};
		}

		let engine;
		if (typeof context.params.engine === "number") {
			if (!language.engines.includes(context.params.engine)) {
				const engines = language.engines.join(", ");
				return {
					success: false,
					reply: `Your selected language does not support that engine version! Choose one of: ${engines}`
				};
			}

			engine = context.params.engine;
		}
		else {
			engine = Math.min(...language.engines);
		}

		let data;
		let statusCode;
		const key = { language: languageCode, link };

		// If force is true, don't even bother fetching the cache data
		const cacheData = (context.params.force) ? null : await this.getCacheData(key);
		if (cacheData) {
			data = cacheData.data;
			statusCode = cacheData.statusCode;
		}
		else {
			const response = await sb.Got.get("GenericAPI")({
				method: "GET",
				responseType: "json",
				throwHttpErrors: false,
				url: "https://api.ocr.space/parse/imageurl",
				headers: {
					apikey: process.env.API_OCR_SPACE
				},
				searchParams: {
					url: link,
					language: language.nonStandardLanguageCode ?? languageCode,
					scale: "true",
					isTable: "true",
					OCREngine: String(engine),
					isOverlayRequired: "false"
				}
			});

			statusCode = response.statusCode;
			data = response.body;

			// set cache with no expiration - only if request didn't time out
			if (!data.ErrorMessage || !data.ErrorMessage.some(i => i.includes("Timed out"))) {
				await this.setCacheData(key, { data, statusCode }, {
					expiry: 30 * 864e5
				});
			}
		}

		if (statusCode !== 200 || data?.OCRExitCode !== 1) {
			return {
				success: false,
				reply: (data?.ErrorMessage)
					? data.ErrorMessage.join(" ")
					: data
			};
		}

		const result = data.ParsedResults[0].ParsedText;
		if (result.length === 0) {
			return {
				success: false,
				reply: `No text found.`
			};
		}
		else {
			return {
				keepWhitespace: true,
				reply: result
			};
		}
	}),
	Dynamic_Description: (async function (prefix) {
		const tableBody = Object.entries(OCR_LANGUAGES).map(([code, definition]) => {
			const name = LanguageCodes.getName(code);
			const engines = definition.engines.join(", ");
			return `<tr><td>${name}</td><td>${code}</td><td>${engines}</td></tr>`;
		}).join("");

		const tableHTML = `
			<table>
				<thead>
					<tr>
						<th>Language</th>
						<th>Code</th>
						<th>Engine versions</th>
					</tr>
				</thead>
				<tbody>
					${tableBody}
				</tbody>
			</table>
		`;

		return [
			"Attempts to read a provided image with OCR, and posts the found text in chat.",
			"You can specify a language, and only 3-letter codes are supported, i.e. 'jpn'.",
			"By default, the language is English (eng).",
			"",

			`<code>${prefix}ocr <a href="https://i.imgur.com/FutGrGV.png">https://i.imgur.com/FutGrGV.png</a></code>`,
			"HELLO WORLD LOL NAM",
			"",

			`<code>${prefix}ocr lang:japanese <a href="https://i.imgur.com/4iK4ZHy.png">https://i.imgur.com/4iK4ZHy.png</a></code>`,
			"ロ明寝マンRetweeted 蜜柑すい@mikansul・May11 ティフアに壁ドンされるだけ",
			"",

			`<code>${prefix}ocr (link) engine:(1, 2, or 3)</code>`,
			"Advanced modee: you can select a specific recognition engine version, if you feel fancy.",
			"By default, the most reliable version will be chosen.",
			"Check the table below to see which language supports which engine versions.",
			"",

			`<code>${prefix}ocr (link) force:true</code>`,
			"Since the results of ocr results are cached, use force:true to forcibly run another detection.",
			"",

			"List of supported languages + engine versions:",
			tableHTML
		];
	})
};
