import { CommandDefinition, declare } from "../../classes/command.js";

type DictionaryApiFailure = {
	title: string;
	message: string;
	resolution: string;
};
type DictionaryApiSuccess = [{
		word: string;
		phonetics: {
			text?: string;
			audio: string;
			sourceUrl?: string;
			license?: unknown;
		}[];
		license: unknown;
		sourceUrls: string[];
		meanings: {
			partOfSpeech: string; // "noun" | "verb" | "interjection" | "adjective" | "adverb"
			definitions: {
				definition: string;
				synonyms: string[];
				antontyms: string[];
				example?: string;
			}[];
			synonyms: string[];
			antontyms: string[];
		}[];
}];
type DictionaryApiResponse = DictionaryApiFailure | DictionaryApiSuccess;

export default declare({
	Name: "dictionary",
	Aliases: ["dict"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches the dictionary definition of a word in English. If there are multiple definitions, you can add \"index:#\" with a number to access specific definition indexes.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [{ name: "index", type: "string" }] as const,
	Whitelist_Response: null,
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

		if (!core.Utils.isValidInteger(index) || index > 100) {
			return {
				success: false,
				reply: "Invalid index number provided!"
			};
		}

		const phrase = encodeURIComponent(args.join(" "));
		const response = await core.Got.get("GenericAPI")<DictionaryApiResponse>({
			url: `https://api.dictionaryapi.dev/api/v2/entries/en/${phrase}`,
			throwHttpErrors: false,
			responseType: "json"
		});

		if ("message" in response.body) {
			return {
				success: false,
				reply: response.body.message
			};
		}

		const { phonetics, meanings, word } = response.body[0];
		const definitions = meanings.flatMap(meaning => {
			const data = meaning.definitions.map(def => ({
				...def,
				type: meaning.partOfSpeech
			}));

			return data;
		});

		if (definitions.length === 0) {
			const phonetic = phonetics.find(i => i.text)?.text ?? "N/A";
			return {
				reply: `${word} (${phonetic}) - no definition has been found!`
			};
		}

		const result = definitions.at(index);
		if (!result) {
			return {
				success: false,
				reply: `There is no item with that index! Maximum index: ${definitions.length}`
			};
		}

		const position = `(index ${index}/${definitions.length - 1})`;
		return {
			reply: `${position} ${word} (${result.type}): ${result.definition}`
		};
	}),
	Dynamic_Description: (prefix) => ([
		"Fetches dictionary definitions of provided phrase in English.",
		"If there's multiple, you can check a different definition by appending the index:# parameter.",
		"",

		`<code>${prefix}dictionary (word)</code>`,
		"Will fetch the phrase's definition in the English language.",
		"",

		`<code>${prefix}dictionary (word) index:3</code>`,
		"Will fetch the phrase's 4th (counting starts from zero) definition in the English language.",
		""
	])
}) satisfies CommandDefinition;
