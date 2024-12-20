const URBAN_FAUX_ACCESS_KEY = "ab71d33b15d36506acf1e379b0ed07ee";
const prepareItemStrings = (item) => {
	const url = new URL(item.permalink);
	const id = url.pathname.replace("/", "");
	const link = `https://urbanup.com/${id}`;

	const thumbs = `(+${item.thumbs_up}/-${item.thumbs_down})`;
	const example = (item.example)
		? ` - Example: ${item.example}`
		: "";

	const content = (item.definition + example).replace(/[\][]/g, "");
	return { link, content, thumbs };
};

module.exports = {
	Name: "urban",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches the top definition of a given term from Urban Dictionary. You can append \"index:#\" at the end to access definitions that aren't first in the search.",
	Flags: ["external-input","mention","non-nullable","pipe"],
	Params: [
		{ name: "index", type: "number" }
	],
	Whitelist_Response: null,
	Code: (async function urban (context, ...args) {
		if (args.length === 0 || args[0] === "random") {
			const randomResponse = await sb.Got.get("GenericAPI")({
				url: "https://api.urbandictionary.com/v0/random"
			});

			const { list } = randomResponse.body;
			const firstItem = list[0];
			const { link, thumbs, content } = prepareItemStrings(firstItem);

			return {
				success: true,
				reply: `${link} ${thumbs} ${content}`
			};
		}

		const term = args.join(" ").toLowerCase();
		const response = await sb.Got.get("GenericAPI")({
			url: "https://api.urbandictionary.com/v0/define",
			searchParams: {
				api_key: URBAN_FAUX_ACCESS_KEY,
				term
			},
			throwHttpErrors: false,
			retry: {
				limit: 0
			},
			timeout: {
				request: 10_000
			}
		});

		if (response.statusCode === 500) {
			const autocompleteResponse = await sb.Got.get("GenericAPI")({
				url: "https://api.urbandictionary.com/v0/autocomplete-extra",
				searchParams: {
					api_key: URBAN_FAUX_ACCESS_KEY,
					term
				},
				retry: {
					limit: 0
				},
				timeout: {
					request: 10_000
				}
			});

			const match = autocompleteResponse.body.results.find(i => i.term.toLowerCase() === term);
			if (match) {
				return {
					reply: `Short description: ${match.preview}`
				};
			}
			else {
				return {
					success: false,
					reply: sb.Utils.tag.trim `
						For whatever reason, UrbanDictionary cannot process this word! 
						Check it for yourself: https://api.urbandictionary.com/v0/define?term=${term}
					`
				};
			}
		}

		if (!response.body.list || response.body.result_type === "no_results") {
			return {
				success: false,
				reply: "No results found!"
			};
		}

		const items = response.body.list
			.filter(i => i.word.toLowerCase() === args.join(" ").toLowerCase())
			.sort((a, b) => b.thumbs_up - a.thumbs_up);

		const index = context.params.index ?? null;
		const item = items[index ?? 0];
		if (!item) {
			return {
				success: false,
				reply: (items.length === 0)
					? `No such definition exists!`
					: `No definition with index ${index ?? 0}! Maximum available: ${items.length - 1}.`
			};
		}

		const { link, thumbs, content } = prepareItemStrings(item);
		return {
			reply: (typeof context.params.index !== "number" && items.length > 1)
				? `${link} ${thumbs} ${content}`
				: `${thumbs} ${content}`
		};
	}),
	Dynamic_Description: async () => [
		`Queries <a href="//urbandictionary.com">UrbanDictionary.com</a> for a definition of a word or aterm.`,
		"If you don't provide a word or use \"random\", a random term will be rolled and posted.",
		"",

		`<code>$urban (term)</code>`,
		`Returns the definition of a term, if it exists`,
		"",

		`<code>$urban index:(number) (term)</code>`,
		`Returns a different definition of the same term, if there are multiple`,
		"Indexes start with 0 (first one) and go up to 9, if there are that many definitions",
		"",

		`<code>$urban</code>`,
		`<code>$urban random</code>`,
		`Returns the definition of a random term`
	]
};
