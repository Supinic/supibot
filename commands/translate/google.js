import { LanguageParser } from "../../utils/languages.js";
const LANGUAGE_LIST_KEY = "google-supported-language-list";

const execute = async function (context, query) {
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

	for (const option of ["from", "to"]) {
		let lang = context.params[option];
		if (!lang) {
			continue;
		}

		if (option === "to" && lang === "random") {
			let codeList = await sb.Cache.getByPrefix(LANGUAGE_LIST_KEY);
			if (!codeList) {
				const response = await sb.Got.get("FakeAgent")({
					url: "https://translate.google.com/",
					responseType: "text"
				});

				if (!response.ok) {
					return {
						success: false,
						reply: "Could not fetch language list!"
					};
				}

				const $ = sb.Utils.cheerio(response.body);
				const codes = [...$("[data-language-code]")].map(i => i.attribs["data-language-code"]);
				const list = new Set(codes.filter(i => {
					if (i === "auto" || i.includes("-")) {
						return false;
					}

					return Boolean(LanguageParser.get(i));
				}));

				codeList = [...list];

				await sb.Cache.setByPrefix(LANGUAGE_LIST_KEY, codeList, {
					expiry: 864e5 // 1 day
				});
			}

			lang = sb.Utils.randArray(codeList);
		}

		const newLang = LanguageParser.get(lang);
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

	const response = await sb.Got.get("FakeAgent")({
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
		const languages = targets.map(i => `${i}: ${LanguageParser.getName(i)}`);
		return {
			success: false,
			reply: `One or both languages are not supported! (${languages.join(", ")})`
		};
	}
	else if (!response.ok) {
		throw new sb.Error.GenericRequest({
			statusCode: response.statusCode,
			statusMessage: response.statusMessage,
			hostname: "TranslateAPI",
			message: response.statusMessage,
			stack: null
		});
	}

	const data = response.body;
	const text = data[0].map(i => i[0]).join(" ");

	const languageID = data[2].replace(/-.*/, "");
	const fromLanguageName = LanguageParser.getName(languageID);
	if (!fromLanguageName) {
		console.warn("$translate - could not get language name", { data, options, languageID });
		return {
			success: false,
			reply: "Language code could not be translated into a name! Please let @Supinic know about this :)"
		};
	}

	const additionalInfo = [];
	if (!textOnly) {
		additionalInfo.push(sb.Utils.capitalize(fromLanguageName));

		if (options.confidence && data[6] && data[6] !== 1) {
			const confidence = `${sb.Utils.round(data[6] * 100, 0)}%`;
			additionalInfo.push(`(${confidence})`);
		}

		const toLanguageName = sb.Utils.capitalize(LanguageParser.getName(options.to));
		additionalInfo.push("→", `${toLanguageName}:`);
	}

	const reply = `${additionalInfo.join(" ")} ${text}`;
	return {
		success: true,
		reply,
		text
	};
};

export default {
	execute
};
