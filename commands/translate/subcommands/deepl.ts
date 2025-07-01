/* eslint-disable array-element-newline */
import { getCode, getName } from "../../../utils/languages.js";
import { SupiError } from "supi-core";
import { TranslateSubcommandDefinition } from "../index.js";

const supportedLanguages: readonly string[] = [
	"bg", "cs", "da", "de", "el",
	"en", "es", "et", "fi", "fr",
	"hu", "id", "it", "ja", "lt",
	"lv", "nl", "pl", "pt", "ro",
	"ru", "sk", "sl", "sv", "tr",
	"uk", "zh"
];

// https://support.deepl.com/hc/en-us/articles/4406432463762-About-the-formal-informal-feature
const formalitySupportedLanguages: readonly string[] = [
	"de", "es", "fr", "it", "ja",
	"nl", "pl", "pt", "ru"
];
const formalitySupportedLanguageNames: readonly string[] = formalitySupportedLanguages
	.map(i => getName(i))
	.filter(Boolean) as string[];

type DeeplSearchParams = {
	text: string;
	source_lang?: string;
	target_lang: string;
	formality?: string;
};
type DeeplTranslateResponse = {
	translations: {
		text: string;
		detected_source_language: string;
	}[];
}

export default {
	name: "deepl",
	title: "DeepL",
	aliases: [],
	default: false,
	description: [
		`<code>$deepl</code>`,
		`<code>$translate engine:deepl</code>`,
		"You can use the DeepL directly by using <code>$deepl</code> or indirectly by specifying <code>engine:deepl</code>",
		"",

		`<code>$deepl formality:(level) to:(language)</code>`,
		"Translates provided text using a specified formality level - \"more\" or \"less\".",
		"This will result in more or less formal reply.",
		`Only supports these languages: ${formalitySupportedLanguageNames.join(", ")}`
	],
	execute: async function (context, subInvocation, query) {
		if (!process.env.API_DEEPL_KEY) {
			throw new SupiError({
				message: "No DeepL key configured (API_DEEPL_KEY)"
			});
		}

		const searchParams: DeeplSearchParams = {
			text: query,
			target_lang: "EN"
		};

		if (context.params.from) {
			const code = getCode(context.params.from);
			if (!code) {
				return {
					success: false,
					reply: `Input language was not recognized!`
				};
			}
			else if (!supportedLanguages.includes(code)) {
				return {
					success: false,
					reply: `Input language is not supported by DeepL!`
				};
			}

			searchParams.source_lang = code;
		}
		else {
			// keep the source_lang property empty - API will attempt to figure it out
		}

		let targetLanguageCode: string | null = null;
		if (context.params.to) {
			if (context.params.to === "random") {
				searchParams.target_lang = core.Utils.randArray(supportedLanguages);
			}
			else {
				targetLanguageCode = getCode(context.params.to);
			}
		}
		else {
			const userDefaultLanguage = await context.user.getDataProperty("defaultUserLanguage");
			targetLanguageCode = (userDefaultLanguage)
				? userDefaultLanguage.code.toUpperCase()
				: "EN";
		}

		if (!targetLanguageCode) {
			return {
				success: false,
				reply: `Invalid or unsupported language provided!`
			};
		}
		else if (!supportedLanguages.includes(targetLanguageCode.toLowerCase())) {
			const rawLanguageName = getName(targetLanguageCode) ?? "(unknown)";
			const languageName = core.Utils.capitalize(rawLanguageName);
			return {
				success: false,
				reply: `Target language (${languageName}) is not supported by DeepL!`
			};
		}

		searchParams.target_lang = targetLanguageCode.toUpperCase();

		if (context.params.formality) {
			const allowedFormalities = ["more", "less", "default"];
			if (!allowedFormalities.includes(context.params.formality)) {
				return {
					success: false,
					reply: `You provided an incorrect formality level! Use one of: ${allowedFormalities.join(", ")}`
				};
			}
			else if (!formalitySupportedLanguages.includes(targetLanguageCode.toLowerCase())) {
				const languageNames = formalitySupportedLanguages
					.map(i => core.Utils.capitalize(getName(i) ?? "(unknown)"))
					.sort();

				return {
					success: false,
					reply: `The language you provided does not support formality! Use one of: ${languageNames.join(", ")}`
				};
			}

			searchParams.formality = context.params.formality;
		}

		const response = await core.Got.get("GenericAPI")<DeeplTranslateResponse>({
			url: "https://api-free.deepl.com/v2/translate",
			headers: {
				Authorization: `DeepL-Auth-Key ${process.env.API_DEEPL_KEY}`
			},
			throwHttpErrors: false,
			searchParams
		});

		if (response.statusCode === 400) {
			return {
				success: false,
				reply: `Invalid language(s) provided!`
			};
		}
		// DeepL uses 456 to signify "exhausted api tokens" instead of 429, which signifies "rate limits exceeded"
		else if (response.statusCode === 456) {
			return {
				success: false,
				reply: `The monthly limit for DeepL has been exhausted! Try again in the next billing period.`
			};
		}
		else if (response.statusCode !== 200) {
			return {
				success: false,
				reply: `The DeepL translation API failed with status code ${response.statusCode}! Try again later.`
			};
		}

		const [data] = response.body.translations;
		const fromLanguageName = core.Utils.capitalize(getName(data.detected_source_language) ?? "(unknown)");
		const toLanguageName = core.Utils.capitalize(getName(searchParams.target_lang) ?? "(unknown)");

		return {
			success: true,
			reply: `${fromLanguageName} → ${toLanguageName}: ${data.text}`,
			text: data.text
		};
	}
} satisfies TranslateSubcommandDefinition;
