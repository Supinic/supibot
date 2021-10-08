module.exports = {
	Name: "define",
	Aliases: ["def"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Combines multiple ways of fetching a definition of a word or a phrase, and picks the best result.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function define (context, ...args) {
		const query = args.join(" ");

		const dictPromise = sb.Got("GenericAPI", {
			url: `https://api.dictionaryapi.dev/api/v1/entries/en/${query}`,
			throwHttpErrors: false,
			responseType: "json"
		});

		const wikiPromise = sb.Got("GenericAPI" ,{
			url: `https://en.wikipedia.org/w/api.php`,
			searchParams: {
				format: "json",
				action: "opensearch",
				limit: "10",
				profile: "fuzzy",
				search: query
			}
		});

		const urbanPromise = sb.Got("GenericAPI", {
			url: "https://api.urbandictionary.com/v0/autocomplete-extra",
			searchParams: {
				term: query
			}
		});

		const result = [];
		const [dictData, wikiData, urbanData] = await Promise.allSettled([dictPromise, wikiPromise, urbanPromise]);
		if (dictData.status === "fulfilled" && dictData.value.statusCode === 200) {
			const data = dictData.value.body;
			const records = data.flatMap(i => Object.entries(i.meaning));
			const items = records.flatMap(([type, value]) => value.map(item => ({ type, definition: item.definition })));
			if (items.length !== 0) {
				result.push(`Dictionary: "${items[0].definition}"`);
			}
		}

		if (urbanData.status === "fulfilled" && urbanData.value.statusCode === 200) {
			const data = urbanData.value.body;
			const match = data.results.find(i => i.term.toLowerCase() === query.toLowerCase());
			if (match) {
				result.push(`Urban: "${match.preview}"`);
			}
		}

		if (wikiData.status === "fulfilled" && wikiData.value.statusCode === 200) {
			const searchData = wikiData.value.body;
			if (searchData[1].length !== 0) {
				const data = await sb.Got("GenericAPI", {
					url: `https://en.wikipedia.org/w/api.php`,
					searchParams: {
						format: "json",
						action: "query",
						prop: "extracts",
						redirects: "1",
						exintro: "0",
						explaintext: "0",
						titles: searchData[1][0]
					}
				});

				const key = Object.keys(data.body.query.pages)[0];
				result.push(`Wiki: https://en.wikipedia.org/?curid=${key}`);
			}
		}

		if (result.length === 0) {
			return {
				success: false,
				reply: `No definitions found!`
			};
		}

		return {
			reply: result.join(" ")
		};
	}),
	Dynamic_Description: null
};
