import * as z from "zod";
import { SupiError } from "supi-core";
import { getCode, getName } from "../../../utils/languages.js";
import type { TranslateSubcommandDefinition } from "../index.js";

type DeeplSearchParams = {
	text: string;
	source_lang?: string;
	target_lang: string;
	formality?: string;
};
type DeeplLanguage = {
	code: string;
	name: string;
	formality: boolean;
};

const translationSchema = z.object({
	translations: z.array(z.object({
		detected_source_language: z.string(),
		text: z.string()
	}))
});
const languageListSchema = z.array(z.object({
	lang: z.string(),
	name: z.string(),
	features: z.object({
		formality: z.object({ status: z.string() }).optional()
	})
}));

const languageKey = "deepl-cached-languages-list";
const getDeeplLanguageList = async (): Promise<DeeplLanguage[]> => {
	const cacheData = await core.Cache.getByPrefix(languageKey) as DeeplLanguage[] | null;
	if (cacheData) {
		return cacheData;
	}

	const response = await core.Got.get("GenericAPI")({
		url: "https://api-free.deepl.com/v3/languages",
		headers: {
			Authorization: `DeepL-Auth-Key ${process.env.API_DEEPL_KEY}`
		},
		throwHttpErrors: false,
		searchParams: { resource: "translate_text" }
	});

	const list = languageListSchema.parse(response.body);
	const storeList = list.map(i => ({
		code: i.lang,
		name: i.name,
		formality: (i.features.formality?.status === "stable")
	}));

	await core.Cache.setByPrefix(languageKey, storeList, { expiry: 3 * 864e5 }); // 3 days
	return storeList;
};

export default {
	name: "deepl",
	title: "DeepL",
	aliases: [],
	default: false,
	getDescription: async (prefix) => {
		const list = await getDeeplLanguageList();
		const formalitySupportedLanguageNames = list
			.filter(i => i.formality)
			.map(i => {
				const localName = getName(i.code);
				return (localName) ? core.Utils.capitalize(localName) : i.name;
			});

		return [
			`<code>${prefix}deepl</code>`,
			`<code>${prefix}translate engine:deepl</code>`,
			"You can use the DeepL directly by using <code>${prefix}deepl</code> or indirectly by specifying <code>engine:deepl</code>",
			"",

			`<code>${prefix}deepl formality:(level) to:(language)</code>`,
			"Translates provided text using a specified formality level - \"more\" or \"less\".",
			"This will result in more or less formal reply.",
			`Only supports these languages: ${formalitySupportedLanguageNames.join(", ")}`
		];
	},
	execute: async function (context, _subInvocation, query) {
		if (!process.env.API_DEEPL_KEY) {
			throw new SupiError({
				message: "No DeepL key configured (API_DEEPL_KEY)"
			});
		}

		const searchParams: DeeplSearchParams = {
			text: query,
			target_lang: "EN"
		};

		const list = await getDeeplLanguageList();
		if (context.params.from) {
			const code = getCode(context.params.from);
			if (!code) {
				return {
					success: false,
					reply: `Input language was not recognized!`
				};
			}

			const isSupported = list.some(i => i.code === code);
			if (!isSupported) {
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
				const { code } = core.Utils.randArray(list);
				searchParams.target_lang = code;
			}
			else {
				targetLanguageCode = getCode(context.params.to);
			}
		}
		else {
			const userDefaultLanguage = await context.user.getDataProperty("defaultUserLanguage");
			targetLanguageCode = (userDefaultLanguage)
				? userDefaultLanguage.code.toLowerCase()
				: "EN";
		}

		if (!targetLanguageCode) {
			return {
				success: false,
				reply: `Invalid or unsupported language provided!`
			};
		}

		const isSupported = list.some(i => i.code === targetLanguageCode);
		if (!isSupported) {
			const rawLanguageName = getName(targetLanguageCode) ?? "(unknown)";
			const languageName = core.Utils.capitalize(rawLanguageName);
			return {
				success: false,
				reply: `Target language (${languageName}) is not supported by DeepL!`
			};
		}

		searchParams.target_lang = targetLanguageCode.toLowerCase();

		if (context.params.formality) {
			const allowedFormalities = ["more", "less", "default"];
			if (!allowedFormalities.includes(context.params.formality)) {
				return {
					success: false,
					reply: `You provided an incorrect formality level! Use one of: ${allowedFormalities.join(", ")}`
				};
			}

			const formalityList = list.filter(i => i.formality);
			const isFormalitySupported = formalityList.some(i => i.code === targetLanguageCode);
			if (!isFormalitySupported) {
				const formalitySupportedLanguageNames = formalityList.map(i => {
					const localName = getName(i.code);
					return (localName) ? core.Utils.capitalize(localName) : i.name;
				});

				return {
					success: false,
					reply: `The language you provided does not support the formality setting! Use one of: ${formalitySupportedLanguageNames.join(", ")}`
				};
			}

			searchParams.formality = context.params.formality;
		}

		const response = await core.Got.get("GenericAPI")({
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

		const [data] = translationSchema.parse(response.body).translations;
		const fromLanguageName = core.Utils.capitalize(getName(data.detected_source_language) ?? "(unknown)");
		const toLanguageName = core.Utils.capitalize(getName(searchParams.target_lang) ?? "(unknown)");

		return {
			success: true,
			reply: `${fromLanguageName} → ${toLanguageName}: ${data.text}`,
			text: data.text
		};
	}
} satisfies TranslateSubcommandDefinition;
