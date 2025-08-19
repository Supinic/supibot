import type { DoesNotExistSubcommandDefinition } from "../index.js";

export default {
	name: "words",
	aliases: [],
	title: "Word",
	default: false,
	description: [
		`<code>word</code> - <a href="https://www.thisworddoesnotexist.com/">This word does not exist (text response)</a>`
	],
	execute: async (context) => {
		const response = await core.Got.get("FakeAgent")({
			url: "https://www.thisworddoesnotexist.com/",
			responseType: "text",
			throwHttpErrors: false
		});

		if (response.statusCode !== 200) {
			return {
				success: false,
				reply: `Could not fetch a random word definition - website error!`
			};
		}

		const $ = core.Utils.cheerio(response.body);
		const wordClass = $("div#definition-pos")
			.text()
			.replaceAll(".", "")
			.trim();

		const word = $("div#definition-word").text();
		const definition = $("div#definition-definition").text().trim();
		// Can be empty string
		const example = $("div#definition-example").text();

		if (context.params.wordOnly) {
			return {
				text: "No link available for this type!",
				reply: word
			};
		}

		return {
			text: "No link available for this type!",
			reply: core.Utils.tag.trim `
				This word does not exist:
				${word} (${wordClass}) -
				${definition}.
				Example: ${example || "N/A"}
			`
		};
	}
} satisfies DoesNotExistSubcommandDefinition;
