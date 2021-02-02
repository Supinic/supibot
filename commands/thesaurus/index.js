module.exports = {
	Name: "thesaurus",
	Aliases: null,
	Author: "supinic",
	Cooldown: 30000,
	Description: "Attempts to re-created your sentence using random synonyms for each word. EXPERIMENTAL",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
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
				.from("cache", "Thesaurus")
				.where("Word IN %s+", words)
			)).map(record => [ record.Word, JSON.parse(record.Result) ])
		);
	
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
	Dynamic_Description: null
};