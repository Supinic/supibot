module.exports = {
	Name: "dictionary",
	Aliases: ["define", "def", "dict"],
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 10000,
	Description: "Fetches the dictionary definition of a word. You can use \"lang:\" to specifiy a language, and if there are multiple definitions, you can add \"index:#\" with a number to access specific definition indexes.",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: ({
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
	}),
	Code: (async function dictionary (context, ...args) {
		if (args.length === 0) {
			return {
				success: false,
				reply: "No word provided!"
			};
		}
	
		let index = 0;
		let language = "en";
		for (let i = args.length - 1; i >= 0; i--) {
			const token = args[i];
			if (token.includes("lang:") || token.includes("language:")) {
				const identifier = token.split(":")[1];
				if (identifier.length <= 5) {
					language = identifier;
				}
				else {
					language = sb.Utils.languageISO.getCode(identifier);
				}
	
				args.splice(i, 1);
			}
			else if (token.includes("index:")) {
				index = Number(token.split(":")[1]);
				args.splice(i, 1);
			}
		}
	
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
	
		const word = encodeURIComponent(args.shift());
		const { statusCode, body: data } = await sb.Got({
			url: `https://api.dictionaryapi.dev/api/v1/entries/${language}/${word}`,
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
		const items = records.flatMap(([type, value]) => value.map(item => ({ type, definition: item.definition })))
		if (items.length === 0) {		
			return {
				reply: `${data[0].word} (${data[0].phonetic ?? "N/A"}) - no word meaning has been found!`
			};
		}
	
		const result = items[index];
		if (!result) {
			return {
				success: false,
				reply: `There is no item with that index! Maximum index: ${items.length}`
			};
		}
	
		const position = `(index ${index}/${items.length - 1})`;
		return {
			reply: `${position} ${data[0].word} (${result.type}): ${result.definition}`
		};
	}),
	Dynamic_Description: async (prefix, values) => {
		const { languages } = values.getStaticData();
		const list = languages.map(([code, name]) => `<li><code>${code}</code> - ${name}</li>`).join("");
	
		return [
			"Fetches dictionary definitions of provided words, also in specific languages.",
			"If there's multiple, you can check a different definition by appending the index:# parameter.",
			"",
	
			`<code>${prefix}dictionary (word)</code>`,
			"Will fetch the word's definition in the English language.",
			"",
	
			`<code>${prefix}dictionary lang:fr (word)</code>`,	
			`<code>${prefix}dictionary language:French (word)</code>`,	
			"Both of these will fetch the word's definition in the French language.",
			"",
	
			`<code>${prefix}dictionary (word) index:3</code>`,
			"Will fetch the word's 4th (counting starts from zero) definition in the English language.",
			"",
	
			"List of supported languages:",
			list
		];
	}
};