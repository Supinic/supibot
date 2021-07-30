module.exports = {
	Name: "translate",
	Aliases: null,
	Author: "supinic",
	Cooldown: 15000,
	Description: "Implicitly translates from auto-recognized language to English. Supports parameters 'from' and 'to'. Example: from:german to:french Guten Tag\",",
	Flags: ["external-input","mention","non-nullable","pipe","use-params"],
	Params: [
		{ name: "confidence", type: "boolean" },
		{ name: "direction", type: "boolean" },
		{ name: "from", type: "string" },
		{ name: "to", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function translate (context, ...args) {
		if (args.length === 0) {
			return {
				success: false,
				reply: "No text for translation provided!",
				cooldown: 2500
			};
		}

		const { languageISO } = sb.Utils.modules;
		const options = {
			from: "auto",
			to: "en",
			// default: true if normal execution, false if inside of pipe
			direction: context.params.direction ?? (!context.append.pipe),
			confidence: context.params.confidence ?? (!context.append.pipe)
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

		const response = await sb.Got({
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
				q: args.join(" ")
			},
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.102 Safari/537.36"
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
		let reply = data[0].map(i => i[0]).join(" ");
		if (options.direction) {
			const languageID = data[2].replace(/-.*/, "");
			const fromLanguageName = languageISO.getName(languageID);
			if (!fromLanguageName) {
				console.warn("$translate - could not get language name", { data, reply, options, languageID });
				return {
					success: false,
					reply: "Language code could not be translated into a name! Please let @Supinic know about this :)"
				};
			}

			const array = [sb.Utils.capitalize(fromLanguageName)];
			if (options.confidence && data[6] && data[6] !== 1) {
				const confidence = `${sb.Utils.round(data[6] * 100, 0)}%`;
				array.push(`(${confidence})`);
			}

			array.push("->", sb.Utils.capitalize(languageISO.getName(options.to)));
			reply = `${array.join(" ")}: ${reply}`;
		}

		return { reply };
	}),
	Dynamic_Description: (async (prefix) => [
		"Translates provided text from one language into another provided language.",
		"Default languages are: from = auto-detected, to = English. This can be changed with the from and to parameters - see below.",
		"",

		`<code>${prefix}translate (text)</code>`,
		"Translates the text from auto-detected language to English.",
		"",

		`<code>${prefix}translate from:fr (text)</code>`,
		`<code>${prefix}translate from:french (text)</code>`,
		`<code>${prefix}translate from:French (text)</code>`,
		"Translates the text from a provided language (French here, can use a language code or name) to English.",
		"The language auto-detection usually works fine. However, if you run into issues or if the text is too short, you can force the source langauge.",
		"",

		`<code>${prefix}translate to:de (text)</code>`,
		`<code>${prefix}translate to:german (text)</code>`,
		`<code>${prefix}translate to:German (text)</code>`,
		"Translates the text from a auto-detected language to a provided language (German here).",
		"",

		`<code>${prefix}translate to:italian from:swahili (text)</code>`,
		"Both parameters can be combined together for maximum accuracy.",
		"",

		`<code>${prefix}translate to:random (text)</code>`,
		"Translates provided text to a randomly picked, supported language.",
		""
	])
};
