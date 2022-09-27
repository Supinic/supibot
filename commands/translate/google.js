const execute = async function (context, query) {
	const { languageISO } = sb.Utils.modules;

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
			let codeList = await this.getCacheData("supported-language-list");
			if (!codeList) {
				const html = await sb.Got("https://translate.google.com/").text();
				const $ = sb.Utils.cheerio(html);
				const codes = Array.from($("[data-language-code]")).map(i => i.attribs["data-language-code"]);
				const list = new Set(codes.filter(i => i !== "auto" && !i.includes("-")));

				codeList = Array.from(list);
				await this.setCacheData("supported-language-list", codeList, {
					expiry: 7 * 864e5 // 7 days
				});
			}

			lang = sb.Utils.randArray(codeList);
		}

		const newLang = languageISO.get(lang);
		const code = newLang?.iso6391 ?? newLang?.iso6392 ?? null;
		if (!code) {
			return {
				success: false,
				reply: `Language "${lang}" was not recognized!`
			};
		}

		options[option] = code.toLowerCase();
	}

	const response = await sb.Got("FakeAgent", {
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
		const languages = targets.map(i => `${i}: ${languageISO.getName(i)}`);
		return {
			success: false,
			reply: `One or both languages are not supported! (${languages.join(", ")})`
		};
	}
	else if (response.statusCode !== 200) {
		throw new sb.errors.GenericRequestError({
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
	const fromLanguageName = languageISO.getName(languageID);
	if (!fromLanguageName) {
		console.warn("$translate - could not get language name", { data, reply, options, languageID });
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

		additionalInfo.push("→", sb.Utils.capitalize(languageISO.getName(options.to)));
	}

	const reply = `${additionalInfo.join(" ")}: ${text}`;
	return {
		reply,
		text
	};
};

module.exports = {
	execute
};
