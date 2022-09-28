module.exports = {
	Name: "dictionary",
	Aliases: ["dict"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches the dictionary definition of a word. You can use \"lang:\" to specifiy a language, and if there are multiple definitions, you can add \"index:#\" with a number to access specific definition indexes.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [
		{ name: "index", type: "string" },
		{ name: "lang", type: "string" },
		{ name: "language", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: (() => ({
		languages: [
			["en", "English"],
			["hi", "Hindi"],
			["es", "Spanish"],
			["fr", "French"],
			["ja", "Japanese"],
			["ru", "Russian"],
			["de", "German"],
			["it", "Italian"],
			["ko", "Korean"],
			["pt-BR", "Brazilian Portuguese - only works via the code"],
			["zh-CN", "Chinese"],
			["ar", "Arabic"],
			["tr", "Turkish"]
		]
	})),
	Code: (async function dictionary (context, ...args) {
		if (args.length === 0) {
			return {
				success: false,
				reply: "No word provided!"
			};
		}

		const index = (typeof context.params.index !== "undefined")
			? Number(context.params.index)
			: 0;

		if (!sb.Utils.isValidInteger(index) || index > 100) {
			return {
				success: false,
				reply: "Invalid index number provided!"
			};
		}

		const languageIdentifier = context.params.lang ?? context.params.language ?? "en";
		const language = (languageIdentifier.length < 5)
			? languageIdentifier
			: sb.Utils.modules.languageISO.getCode(languageIdentifier);

		if (!language) {
			return {
				success: false,
				reply: "Invalid language provided!"
			};
		}
		else if (!this.staticData.languages.map(i => i[0]).includes(language)) {
			return {
				success: false,
				reply: "Your provided language is not supported by the Dictionary API!"
			};
		}

		const phrase = encodeURIComponent(args.join(" "));
		const { statusCode, body: data } = await sb.Got({
			url: `https://api.dictionaryapi.dev/api/v1/entries/${language}/${phrase}`,
			throwHttpErrors: false,
			responseType: "json"
		});

		if (statusCode !== 200) {
			return {
				success: false,
				reply: data.message
			};
		}

		const records = data.flatMap(i => Object.entries(i.meaning));
		const items = records.flatMap(([type, value]) => value.map(item => ({ type, definition: item.definition })));
		if (items.length === 0) {
			return {
				reply: `${data[0].word} (${data[0].phonetic ?? "N/A"}) - no phrase definition has been found!`
			};
		}

		const result = items[index];
		if (!result) {
			return {
				success: false,
				reply: `There is no item with that index! Maximum index: ${items.length}`
			};
		}

		// Apparently, especially for multi-word phrases, the API returns its type as "undefined" (string)
		const type = (result.type === "undefined") ? "N/A" : result.type;
		const position = `(index ${index}/${items.length - 1})`;
		return {
			reply: `${position} ${data[0].word} (${type}): ${result.definition}`
		};
	}),
	Dynamic_Description: (async function (prefix) {
		const { languages } = this.staticData;
		const list = languages.map(([code, name]) => `<li><code>${code}</code> - ${name}</li>`).join("");

		return [
			"Fetches dictionary definitions of provided phrase, also in specific languages.",
			"If there's multiple, you can check a different definition by appending the index:# parameter.",
			"",

			`<code>${prefix}dictionary (word)</code>`,
			"Will fetch the phrase's definition in the English language.",
			"",

			`<code>${prefix}dictionary lang:fr (word)</code>`,
			`<code>${prefix}dictionary language:French (word)</code>`,
			"Both of these will fetch the phrase's definition in the French language.",
			"",

			`<code>${prefix}dictionary (word) index:3</code>`,
			"Will fetch the phrase's 4th (counting starts from zero) definition in the English language.",
			"",

			"List of supported languages:",
			list
		];
	})
};
