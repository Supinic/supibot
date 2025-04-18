import { randomInt } from "../../utils/command-utils.js";

export default {
	Name: "thesaurus",
	Aliases: null,
	Author: "supinic",
	Cooldown: 30000,
	Description: "Attempts to re-creates your sentence using random synonyms for each word.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [
		{ name: "singleWord", type: "boolean" }
	],
	Whitelist_Response: null,
	Code: (async function thesaurus (context, ...words) {
		if (words.length === 0) {
			return {
				reply: "No message provided!"
			};
		}

		const wordsData = await core.Query.getRecordset(rs => rs
			.select("Word", "Result")
			.from("data", "Thesaurus")
			.where("Word IN %s+", words)
		);

		const thesaurus = {};
		for (const record of wordsData) {
			thesaurus[record.Word] = JSON.parse(record.Result);
		}

		if (context.params.singleWord) {
			const synonyms = thesaurus[words[0]];
			if (synonyms && synonyms.length !== 0) {
				return {
					reply: synonyms.sort().join(", ")
				};
			}
			else {
				return {
					success: false,
					reply: "No synonyms found for this word!"
				};
			}
		}

		const result = [];
		for (const rawWord of words) {
			const word = rawWord.toLowerCase();
			const roll = randomInt(1, 3);

			// With a chance of 2 in 3, transmute the word into a synonym
			if (thesaurus[word] && roll > 1) {
				result.push(core.Utils.randArray(thesaurus[word]));
			}
			else {
				result.push(rawWord);
			}
		}

		return {
			reply: result.join(" ")
		};
	}),
	Dynamic_Description: (async (prefix) => [
		"Re-creates your sentence using random synonyms for each word, if available.",
		"By default, has a 66% chance to replace a word with a random synonym - if that exists.",
		"",

		`<code>${prefix}thesaurus hello my name is John and I am doing well</code>`,
		"greeting my kinsfolk is room and I amplitude modulation doing well",

		`<code>${prefix}thesaurus (word) singleWord:true</code>`,
		"Replies with a list of possible synonyms for the word you provided.",
		"",

		`<code>${prefix}thesaurus population singleWord:true</code>`,
		"accumulation, aggregation, assemblage, collection, colonisation, colonization, group, grouping, integer, people, settlement, universe, whole number"
	])
};
