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

const execute = async (context, query) => {
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

	if (context.params.to) {
		if (context.params.to === "random") {
			searchParams.target_lang = sb.Utils.randArray(supportedLanguages);
		}
		else {
			const code = languageISO.getCode(context.params.to);
			if (!code) {
				return {
					success: false,
					reply: `Output language was not recognized!`
				};
			}
			else if (!supportedLanguages.includes(code)) {
				return {
					success: false,
					reply: `Output language is not supported by DeepL!`
				};
			}

			searchParams.target_lang = code;
		}
	}
	else {
		searchParams.target_lang = "EN";
	}

	const response = await sb.Got("GenericAPI", {
		url: "https://api-free.deepl.com/v2/translate",
		headers: {
			Authorization: `DeepL-Auth-Key ${sb.Config.get("API_DEEPL_KEY")}`
		},
		searchParams
	});

	if (response.statusCode === 400) {
		return {
			success: false,
			reply: `Invalid language(s) provided!`
		};
	}
	else if (response.statusCode === 429) {
		return {
			success: false,
			reply: `The monthly limit for DeepL has been exhausted! Try again next month.`
		};
	}

	const [data] = response.body.translations;
	const fromLanguageName = sb.Utils.capitalize(languageISO.getName(data.detected_source_language));
	const toLanguageName = sb.Utils.capitalize(languageISO.getName(searchParams.target_lang));

	return {
		reply: `${fromLanguageName} → ${toLanguageName}: ${data.text}`,
		text: data.text
	};
};

module.exports = {
	execute
};
