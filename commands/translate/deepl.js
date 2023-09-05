const supportedLanguages = [
	"bg",
	"cs",
	"da",
	"de",
	"el",
	"en",
	"es",
	"et",
	"fi",
	"fr",
	"hu",
	"id",
	"it",
	"ja",
	"lt",
	"lv",
	"nl",
	"pl",
	"pt",
	"ro",
	"ru",
	"sk",
	"sl",
	"sv",
	"tr",
	"uk",
	"zh"
];

// https://support.deepl.com/hc/en-us/articles/4406432463762-About-the-formal-informal-feature
const formalitySupportedLanguages = [
	"de",
	"es",
	"fr",
	"it",
	"ja",
	"nl",
	"pl",
	"pt",
	"ru"
];

const execute = async function (context, query) {
	const { languageISO } = sb.Utils.modules;
	const searchParams = {
		text: query
	};

	if (context.params.from) {
		const code = languageISO.getCode(context.params.from);
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

	let targetLanguageCode;
	if (context.params.to) {
		if (context.params.to === "random") {
			searchParams.target_lang = sb.Utils.randArray(supportedLanguages);
		}
		else {
			targetLanguageCode = languageISO.getCode(context.params.to);
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
		const languageName = sb.Utils.capitalize(languageISO.getName(targetLanguageCode));
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
				.map(i => sb.Utils.capitalize(languageISO.getName(i)))
				.sort();

			return {
				success: false,
				reply: `The language you provided does not support formality! Use one of: ${languageNames.join(", ")}`
			};
		}

		searchParams.formality = context.params.formality;
	}

	const response = await sb.Got("GenericAPI", {
		url: "https://api-free.deepl.com/v2/translate",
		headers: {
			Authorization: `DeepL-Auth-Key ${sb.Config.get("API_DEEPL_KEY")}`
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
	const fromLanguageName = sb.Utils.capitalize(languageISO.getName(data.detected_source_language));
	const toLanguageName = sb.Utils.capitalize(languageISO.getName(searchParams.target_lang));

	return {
		success: true,
		reply: `${fromLanguageName} → ${toLanguageName}: ${data.text}`,
		text: data.text
	};
};

module.exports = {
	execute
};
