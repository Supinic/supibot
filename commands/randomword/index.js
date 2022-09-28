module.exports = {
	Name: "randomword",
	Aliases: ["rw"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Fetches a random word. If a number is provided, rolls that many words.",
	Flags: ["pipe"],
	Params: [
		{ name: "endsWith", type: "string" },
		{ name: "regex", type: "regex" },
		{ name: "startsWith", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: (() => ({
		limit: 10
	})),
	Code: (async function randomWord (context, number = 1) {
		const repeats = Number(number);
		if (!repeats || repeats > this.staticData.limit || repeats < 1 || Math.trunc(repeats) !== repeats) {
			return {
				success: false,
				reply: "Invalid or too high amount of words!"
			};
		}

		const { endsWith, regex, startsWith } = context.params;

		// performance "save" - skip filtering if not needed
		let wordList;
		if (!endsWith && !regex && !startsWith) {
			wordList = sb.Config.get("WORD_LIST");
		}
		else {
			wordList = sb.Config.get("WORD_LIST").filter(word => {
				let result = true;
				if (endsWith) {
					result &&= word.endsWith(endsWith);
				}
				if (startsWith) {
					result &&= word.startsWith(startsWith);
				}
				if (regex) {
					result &&= regex.test(word);
				}

				return result;
			});
		}

		if (wordList.length === 0) {
			return {
				success: false,
				reply: `Your filtering is too specific!`
			};
		}

		const words = [];
		for (let i = 0; i < repeats; i++) {
			words.push(sb.Utils.randArray(wordList));
		}

		return {
			reply: words.join(" ")
		};
	}),
	Dynamic_Description: (async (prefix) => {
		const { limit } = this.staticData;
		const list = sb.Config.get("WORD_LIST");

		return [
			`Returns a random word from a list of ${list.length} pre-determined words.`,
			"Highly recommended for its usage in pipe, for example into urban or translate...",
			`Maximum amount of words: ${limit}`,
			"",

			`<code>${prefix}rw</code>`,
			"(one random word)",
			"",

			`<code>${prefix}rw 10</code>`,
			"(ten random words)",
			"",

			`<code>${prefix}rw startsWith:(text)</code>`,
			"One random word that starts with the specified text",
			"",

			`<code>${prefix}rw endsWith:(text)</code>`,
			"One random word that ends with the specified text",
			"",

			`<code>${prefix}rw regex:(regular expression)</code>`,
			"One random word that satisfies the provided regular expression",
			"",

			`<a href="https://pastebin.com/gUxBX1BL">Word list (Pastebin)</a>`
		];
	})
};
