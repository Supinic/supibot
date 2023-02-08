module.exports = {
	Name: "dictionary",
	Aliases: ["dict"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches the dictionary definition of a word in English. If there are multiple definitions, you can add \"index:#\" with a number to access specific definition indexes.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [
		{ name: "index", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: null,
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

		const phrase = encodeURIComponent(args.join(" "));
		const { statusCode, body: data } = await sb.Got({
			url: `https://api.dictionaryapi.dev/api/v1/entries/en/${phrase}`,
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
		return [
			"Fetches dictionary definitions of provided phrase in English.",
			"If there's multiple, you can check a different definition by appending the index:# parameter.",
			"",

			`<code>${prefix}dictionary (word)</code>`,
			"Will fetch the phrase's definition in the English language.",
			"",

			`<code>${prefix}dictionary (word) index:3</code>`,
			"Will fetch the phrase's 4th (counting starts from zero) definition in the English language.",
			""
		];
	})
};
