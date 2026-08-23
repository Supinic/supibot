import * as z from "zod";
import { SupiError } from "supi-core";
import { hasDefinition, getName, getDefinition } from "../../../utils/languages.js";
import type { TranslateSubcommandDefinition } from "../index.js";

const LANGUAGE_LIST_KEY = "google-supported-language-list";
const resultSchema = z.union([
	z.tuple([z.string()]),
	z.tuple([
		z.tuple([z.string(), z.string()])
	])
]);

const getGoogleLanguageList = async () => {
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

			return hasDefinition(i);
		}));

		codeList = [...list];

		await core.Cache.setByPrefix(LANGUAGE_LIST_KEY, codeList, {
			expiry: 864e5 // 1 day
		});
	}

	return codeList;
};

export default {
	name: "google",
	title: "Google",
	aliases: [],
	default: true,
	description: [],
	getDescription: async () => {
		const rawList = await getGoogleLanguageList();
		const list = rawList.sort();

		return [
			"List of supported language codes, as provided by Google:",
			`<code>${list.join(" ")}</code>`
		];
	},
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
			to: "en"
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

			const newLang = getDefinition(lang);
			const code = newLang?.iso6391 ?? newLang?.iso6392 ?? newLang?.iso6393 ?? null;
			if (!code) {
				return {
					success: false,
					reply: `Could not recognize language "${lang}"!`
				};
			}

			options[option] = code.toLowerCase();
		}

		if (!context.params.to && options.to === "en") {
			const userDefaultLanguage = await context.user.getDataProperty("defaultUserLanguage");
			options.to = (userDefaultLanguage) ? userDefaultLanguage.code.toLowerCase() : "en";
		}

		const response = await core.Got.get("FakeAgent")({
			url: "https://clients5.google.com/translate_a/t",
			responseType: "json",
			headers: {
				"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36"
			},
			throwHttpErrors: false,
			searchParams: {
				client: "dict-chrome-ex",
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

		let text: string;
		let fromLanguageId: string = options.from;
		const data = resultSchema.parse(response.body);
		if (Array.isArray(data[0])) {
			text = data[0][0];
			fromLanguageId = data[0][1];
		}
		else {
			text = data[0];
		}

		let fromLanguageName = getName(fromLanguageId);
		if (!fromLanguageName) {
			console.warn("$translate - could not get language name", { data, options, fromLanguageId, query });
			fromLanguageName = `(language code: ${fromLanguageId})`;
		}

		const additionalInfo = [];
		if (!textOnly) {
			additionalInfo.push(core.Utils.capitalize(fromLanguageName));
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
