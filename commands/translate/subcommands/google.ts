import { SupiError } from "supi-core";
import { get as getLanguage, getName } from "../../../utils/languages.js";
import type { TranslateSubcommandDefinition } from "../index.js";

const LANGUAGE_LIST_KEY = "google-supported-language-list";

export const getGoogleLanguageList = async () => {
	let codeList = await core.Cache.getByPrefix(LANGUAGE_LIST_KEY) as string[] | null;
	if (!codeList) {
		const response = await core.Got.get("FakeAgent")({
			url: "https://translate.google.com/",
			responseType: "text"
		});

		if (!response.ok) {
			throw new SupiError({
				message: "Could not load Google Translate API language list"
			});
		}

		const $ = core.Utils.cheerio(response.body);
		const codes = [...$("[data-language-code]")].map(i => i.attribs["data-language-code"]);
		const list = new Set(codes.filter(i => {
			if (i === "auto" || i.includes("-")) {
				return false;
			}

			return Boolean(getLanguage(i));
		}));

		codeList = [...list];

		await core.Cache.setByPrefix(LANGUAGE_LIST_KEY, codeList, {
			expiry: 864e5 // 1 day
		});
	}

	return codeList;
};

type GoogleTranslateResponse = [
	[
		string,
		string,
		unknown,
		unknown,
		number,
		unknown,
		unknown,
		[string, string],
		[string, string]
	][],
	unknown,
	string,
	unknown,
	unknown,
	unknown,
	number | null,
	[]
];

export default {
	name: "google",
	title: "Google",
	aliases: [],
	default: true,
	description: [
		`<code>$translate confidence:(true | false) (text)</code>`,
		"<b>Only works for the Google translation engine!</b>",
		"Translates the text, and outputs the result text with direction, but without the confidence percentage.",
		"",

		"See examples:",
		`<code>$translate confidence:true FeelsDankMan</code> => English (51%) -> English: FeelsDankMan`,
		`<code>$translate confidence:false FeelsDankMan</code> => English -> English: FeelsDankMan`
	],
	execute: async function (context, type, query) {
		if (context.params.formality) {
			return {
				success: false,
				reply: `You cannot use the "formality" parameter with Google! Use DeepL by using "engine:deepl".`
			};
		}

		// default: false if normal execution, true if inside of pipe
		const textOnly = context.params.textOnly ?? context.append.pipe;
		const options = {
			from: "auto",
			to: "en",
			confidence: context.params.confidence ?? !textOnly
		};

		for (const option of ["from", "to"] as const) {
			let lang = context.params[option];
			if (!lang) {
				continue;
			}

			if (option === "to" && lang === "random") {
				const codeList = await getGoogleLanguageList();
				lang = core.Utils.randArray(codeList);
			}

			const newLang = getLanguage(lang);
			const code = newLang?.iso6391 ?? newLang?.iso6392 ?? newLang?.iso6393 ?? null;
			if (!code) {
				return {
					success: false,
					reply: `Language "${lang}" was not recognized!`
				};
			}

			options[option] = code.toLowerCase();
		}

		if (!context.params.to && options.to === "en") {
			const userDefaultLanguage = await context.user.getDataProperty("defaultUserLanguage");

			options.to = (userDefaultLanguage)
				? userDefaultLanguage.code.toLowerCase()
				: "en";
		}

		const response = await core.Got.get("FakeAgent")<GoogleTranslateResponse>({
			url: "https://translate.googleapis.com/translate_a/single",
			responseType: "json",
			throwHttpErrors: false,
			searchParams: {
				client: "gtx",
				dt: "t",
				ie: "UTF-8",
				oe: "UTF-8",
				sl: options.from,
				tl: options.to,
				q: query
			}
		});

		if (response.statusCode === 400) {
			const targets = [options.from, options.to].filter(i => i !== "en" && i !== "auto");
			const languages = targets.map(i => `${i}: ${getName(i)}`);
			return {
				success: false,
				reply: `One or both languages are not supported! (${languages.join(", ")})`
			};
		}
		else if (!response.ok) {
			return {
				success: false,
				reply: `Google Translate API encountered an error! Please try again later.`
			};
		}

		const data = response.body;
		const text = data[0].map(i => i[0]).join(" ");

		const languageID = data[2].replace(/-.*/, "");
		const fromLanguageName = getName(languageID);
		if (!fromLanguageName) {
			console.warn("$translate - could not get language name", { data, options, languageID });
			return {
				success: false,
				reply: "Language code could not be translated into a name! Please let @Supinic know about this :)"
			};
		}

		const additionalInfo = [];
		if (!textOnly) {
			additionalInfo.push(core.Utils.capitalize(fromLanguageName));

			if (options.confidence && data[6] && data[6] !== 1) {
				const confidence = `${core.Utils.round(data[6] * 100, 0)}%`;
				additionalInfo.push(`(${confidence})`);
			}

			const toLanguageName = core.Utils.capitalize(getName(options.to) ?? "(unknown)");
			additionalInfo.push("→", `${toLanguageName}:`);
		}

		const reply = `${additionalInfo.join(" ")} ${text}`;
		return {
			success: true,
			reply,
			text
		};
	}
} satisfies TranslateSubcommandDefinition;
