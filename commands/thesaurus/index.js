module.exports = {
	Name: "thesaurus",
	Aliases: null,
	Author: "supinic",
	Cooldown: 30000,
	Description: "Attempts to re-creates your sentence using random synonyms for each word.",
	Flags: ["mention","non-nullable","pipe","use-params"],
	Params: [
		{ name: "singleWord", type: "boolean" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function thesaurus (context, ...words) {
		if (words.length === 0) {
			return {
				reply: "No message provided!"
			};
		}
	
		const thesaurus = Object.fromEntries(
			(await sb.Query.getRecordset(rs => rs
				.select("Word", "Result")
				.from("data", "Thesaurus")
				.where("Word IN %s+", words)
			)).map(record => [ record.Word, JSON.parse(record.Result) ])
		);

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
			const roll = sb.Utils.random(1, 3);
	
			// With a chance of 2 in 3, transmute the word into a synonym
			if (thesaurus[word] && roll > 1) {
				result.push(sb.Utils.randArray(thesaurus[word]));
			}
			else {
				result.push(rawWord);
			}
		}
	
		return {
			reply: result.join(" ")
		};
	}),
	Dynamic_Description: (async (prefix) => {
		return [
			"Re-creates your sentence using random synonyms for each word, if available.",
			"By default, has a 66% chance to replace a word with a random synonym - if that exists.",
			"",

			`<code>${prefix}thesaurus hello my name is John and I am doing well</code>`,
			"greeting my kinsfolk is room and I amplitude modulation doing well "

			`<code>${prefix}thesaurus (word) singleWord:true</code>`,
			"Replies with a list of possible synonyms for the word you provided.",
			"",

			`<code>${prefix}thesaurus population singleWord:true</code>`,
			"accumulation, aggregation, assemblage, collection, colonisation, colonization, group, grouping, integer, people, settlement, universe, whole number"
		];
	})
};