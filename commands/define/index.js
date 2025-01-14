const LanguageCodes = require("../../utils/languages");
module.exports = {
	Name: "define",
	Aliases: ["def"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Combines multiple ways of fetching a definition of a word or a phrase, and picks the best result.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [
		{ name: "lang", type: "string" }
	],
	Whitelist_Response: null,
	Code: (async function define (context, ...args) {
		const query = args.join(" ");
		if (!query) {
			return {
				success: false,
				reply: `No input provided!`
			};
		}

		const { checkPartialCommandFilters } = require("./check-partials.js");
		const allowedPartials = await checkPartialCommandFilters(context, args);

		let languageCode = "en";
		if (context.params.lang) {
			languageCode = LanguageCodes.getCode(context.params.lang, "iso6391");
			if (!languageCode) {
				return {
					success: false,
					reply: `Your provided language is not supported!`
				};
			}
		}

		let dictPromise;
		if (allowedPartials.dictionary) {
			dictPromise = sb.Got.get("GenericAPI")({
				url: `https://api.dictionaryapi.dev/api/v1/entries/en/${query}`,
				throwHttpErrors: false,
				responseType: "json"
			});
		}

		let wikiPromise;
		let wiktionaryPromise;
		if (allowedPartials.wiki) {
			wikiPromise = sb.Got.get("GenericAPI")({
				url: `https://${languageCode}.wikipedia.org/w/api.php`,
				searchParams: {
					format: "json",
					action: "opensearch",
					limit: "10",
					profile: "fuzzy",
					search: query
				}
			});

			wiktionaryPromise = sb.Got.get("FakeAgent")({
				url: `https://${languageCode}.wiktionary.org/wiki/${encodeURIComponent(query)}`,
				throwHttpErrors: false,
				responseType: "text"
			});
		}

		let urbanPromise;
		if (allowedPartials.urban) {
			urbanPromise = sb.Got.get("GenericAPI")({
				url: "https://api.urbandictionary.com/v0/define",
				searchParams: {
					term: query
				},
				throwHttpErrors: false,
				retry: {
					limit: 0
				},
				timeout: {
					request: 5000
				}
			});
		}

		const result = [];
		const [dictData, wikiData, wiktionaryData, urbanData] = await Promise.allSettled([dictPromise, wikiPromise, wiktionaryPromise, urbanPromise]);

		// If a custom non-English language is used, the Dictionary and Urban API responses are skipped,
		// as they do not support non-English languages.
		if (languageCode === "en") {
			if (dictData.status === "fulfilled" && dictData.value?.statusCode === 200 && Array.isArray(dictData.value.body)) {
				const data = dictData.value.body;
				const records = data.flatMap(i => Object.entries(i.meaning));

				const items = records.flatMap(([type, value]) => value.map(item => ({
					type,
					definition: item.definition
				})));

				if (items.length !== 0) {
					result.push(`Dictionary: "${sb.Utils.wrapString(items[0].definition, 150)}"`);
				}
			}

			if (urbanData.status === "fulfilled" && urbanData.value?.statusCode === 200) {
				const data = urbanData.value.body;
				const [item] = data.list
					.filter(i => i.word.toLowerCase() === query.toLowerCase())
					.sort((a, b) => b.thumbs_up - a.thumbs_up);

				if (item) {
					const definition = sb.Utils.wrapString(item.definition.replaceAll(/[[\]]/g, ""), 150);
					result.push(`Urban: "${definition}"`);
				}
			}
		}

		if (wikiData.status === "fulfilled" && wikiData.value?.statusCode === 200) {
			const searchData = wikiData.value.body;
			if (searchData[1].length !== 0) {
				const data = await sb.Got.get("GenericAPI")({
					url: `https://${languageCode}.wikipedia.org/w/api.php`,
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
				let message = `Wiki: https://${languageCode}.wikipedia.org/?curid=${key}`;
				if (languageCode !== "en") {
					const { extract } = data.body.query.pages[key];
					message += ` ${sb.Utils.wrapString(extract, 150)}`;
				}

				result.push(message);
			}
		}

		if (wiktionaryData.status === "fulfilled" && wiktionaryData.value?.statusCode === 200) {
			result.push(`Wiktionary: ${wiktionaryData.value.url}`);
		}

		if (result.length === 0) {
			const checkedCommands = Object.values(allowedPartials);
			const filteredCommandsCount = checkedCommands.filter(i => i === false).length;
			if (filteredCommandsCount === checkedCommands.length) {
				return {
					success: false,
					reply: sb.Utils.tag.trim `
						This command cannot fetch anything, because all of its sources have been filtered out!
						Check this command's help article if you're unsure why.
					`
				};
			}

			return {
				success: false,
				reply: `No definitions found!`
			};
		}

		return {
			reply: result.join(" ")
		};
	}),
	Dynamic_Description: (async (prefix) => [
		`Combines four different ways of fetching a definition for a term, word, anything.`,
		"Uses the following data sources:",
		`<ul>
			<li><a href="//dictionaryapi.dev">DictionaryAPI.dev</a></li>
			<li><a href="//urbandictionary.com">Urban Dictionary</a></li>
			<li><a href="//en.wikipedia.org">Wikipedia</a></li>
			<li><a href="//en.wiktionary.org">Wiktionary</a></li>		
		</ul>`,
		"",

		"If any of the partial commands for the sources is banned in the current context, it will also apply to this command.",
		"E.g. if you block <code>$urban</code> in a channel, this command will skip the UrbanDictionary part of its result.",
		`This similarly applies to the other commands - <code>$dictionary</code> and <code>$wiki</code>.`,
		"",

		`<code>${prefix}define (term)</code>`,
		`<code>${prefix}define Twitch.tv</code>`,
		"Provides up to four different definitions.",
		"",

		`<code>${prefix}define <u>lang:(language)</u> (term)</code>`,
		`<code>${prefix}define <u>lang:polish Grzegorz Brzęczyszczykiewicz</u></code>`,
		`<code>${prefix}define <u>lang:FI mämmi</u></code>`,
		"Provides language-specific definitions.",
		"However, if the language selected isn't English, only results from Wikipedia and Wiktionary are used."
	])
};
