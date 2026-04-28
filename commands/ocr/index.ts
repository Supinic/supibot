import * as z from "zod";
import { SupiError } from "supi-core";
import { getCode, getName } from "../../utils/languages.js";
import { declare } from "../../classes/command.js";
import RAW_OCR_LANGUAGES from "./ocr-languages.json" with { type: "json" };

type CacheData = { statusCode: number; text: string | null; };
const ocrLanguageSchema = z.array(z.tuple([
	z.string(),
	z.object({
		engines: z.array(z.number()),
		nonStandardLanguageCode: z.string().optional()
	})
]));
const ocrRequestSchema = z.object({
	ErrorMessage: z.array(z.string()).optional(),
	OCRExitCode: z.number(),
	ParsedResults: z.array(z.object({
		ErrorMessage: z.string(), // empty string on success
		ParsedText: z.string()
	})).optional()
});

const OCR_LANGUAGES = ocrLanguageSchema.parse(RAW_OCR_LANGUAGES);
const ocrLanguages = new Map(OCR_LANGUAGES);
const ocrLanguageNames = OCR_LANGUAGES.map(([code]) => getName(code) ?? "(N/A)");

const getCacheKey = (link: string) => `ocr-cache-link-${link}`;

export default declare({
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
	Code: async function ocr (context, ...args) {
		if (!process.env.API_OCR_SPACE) {
			throw new SupiError({
				message: "No OCR Space key configured (API_OCR_SPACE)"
			});
		}

		let languageCode: string | null = "eng";
		if (context.params.lang) {
			languageCode = getCode(context.params.lang, "iso6393");
		}

		if (!languageCode) {
			return {
				success: false,
				reply: "Provided language could not be parsed!"
			};
		}

		const language = ocrLanguages.get(languageCode);
		if (!language) {
			return {
				success: false,
				reply: `Language is not supported! Use one of these: ${ocrLanguageNames.join(", ")}`,
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

		const key = getCacheKey(link);
		const existingCacheData = (context.params.force)
			? null
			: (await this.getCacheData(key) as CacheData | null);

		if (existingCacheData) {
			return {
				success: true,
				keepWhitespace: true,
				reply: existingCacheData.text
			};
		}

		const response = await core.Got.get("GenericAPI")({
			method: "GET",
			responseType: "json",
			throwHttpErrors: false,
			url: "https://api.ocr.space/parse/imageurl",
			headers: {
				apikey: process.env.API_OCR_SPACE
			},
			searchParams: {
				apikey: process.env.API_OCR_SPACE,
				url: link,
				language: language.nonStandardLanguageCode ?? languageCode,
				scale: "true",
				isTable: "true",
				OCREngine: String(engine),
				isOverlayRequired: "false"
			}
		});

		const statusCode = response.statusCode;
		const data = ocrRequestSchema.parse(response.body);
		if (!response.ok || data.OCRExitCode !== 1 || data.ErrorMessage || !data.ParsedResults) {
			const errorMessage = (data.ErrorMessage) ? data.ErrorMessage[0] : "(N/A)";
			return {
				success: false,
				reply: `Couldn't run OCR on your link! Error message: ${errorMessage}`
			};
		}

		const text = data.ParsedResults[0].ParsedText;
		const newCacheData = { text, statusCode } satisfies CacheData;
		await this.setCacheData(key, newCacheData, {
			expiry: 30 * 864e5
		});

		if (text.length === 0) {
			return {
				success: false,
				reply: `No text found.`
			};
		}
		else {
			return {
				keepWhitespace: true,
				reply: text
			};
		}
	},
	Dynamic_Description: function (prefix) {
		const tableBody = [];
		for (const [code, def] of ocrLanguages.entries()) {
			const name = getName(code) ?? "(N/A)";
			const engines = def.engines.join(", ");

			tableBody.push(`<tr><td>${name}</td><td>${code}</td><td>${engines}</td></tr>`);
		}

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
					${tableBody.join("")}
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
	}
});
