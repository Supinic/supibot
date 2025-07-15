import { declare } from "../../classes/command.js";

const URBAN_FAUX_ACCESS_KEY = "ab71d33b15d36506acf1e379b0ed07ee";

type UrbanItem = {
	author: string;
	current_vote: string;
	defid: number;
	definition: string;
	example: string;
	permalink: string;
	thumbs_up: number;
	thumbs_down: number;
	word: string;
	written_on: string; // Date string
};
type UrbanResponse = {
	list: UrbanItem[];
};

type UrbanAutocompleteItem = {
	preview: string;
	term: string;
};
type UrbanAutocompleteResponse = {
	results: UrbanAutocompleteItem[];
};

const prepareItemStrings = (item: UrbanItem) => {
	const url = new URL(item.permalink);
	// const id = url.pathname.replace("/", ""); // Looks like this no longer works as of cca. 2025-07-06
	const id = url.searchParams.get("defid");
	const link = `https://urbanup.com/${id}`;

	const thumbs = `(+${item.thumbs_up}/-${item.thumbs_down})`;
	const example = (item.example)
		? ` - Example: ${item.example}`
		: "";

	const content = (item.definition + example).replaceAll(/[\][]/g, "");
	return { link, content, thumbs };
};

export default declare({
	Name: "urban",
	Aliases: null,
	Cooldown: 10000,
	Description: "Fetches the top definition of a given term from Urban Dictionary. You can append \"index:#\" at the end to access definitions that aren't first in the search.",
	Flags: ["external-input","mention","non-nullable","pipe"],
	Params: [
		{ name: "index", type: "number" }
	],
	Whitelist_Response: null,
	Code: (async function urban (context, ...args) {
		if (args.length === 0 || args[0] === "random") {
			const randomResponse = await core.Got.get("GenericAPI")<UrbanResponse>({
				url: "https://api.urbandictionary.com/v0/random"
			});

			const { list } = randomResponse.body;
			const firstItem = list[0];
			const { link, thumbs, content } = prepareItemStrings(firstItem);

			return {
				success: true,
				reply: `${firstItem.word}: ${link} ${thumbs} ${content}`
			};
		}

		const term = args.join(" ").toLowerCase();
		const response = await core.Got.get("GenericAPI")<UrbanResponse>({
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
			const autocompleteResponse = await core.Got.get("GenericAPI")<UrbanAutocompleteResponse>({
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
					reply: core.Utils.tag.trim `
						For whatever reason, UrbanDictionary cannot process this word! 
						Check it for yourself: https://api.urbandictionary.com/v0/define?term=${term}
					`
				};
			}
		}

		if (response.body.list.length === 0) {
			return {
				success: false,
				reply: "No such definition exists!"
			};
		}

		const items = response.body.list
			.filter(i => i.word.toLowerCase() === args.join(" ").toLowerCase())
			.sort((a, b) => b.thumbs_up - a.thumbs_up);

		const index = context.params.index ?? 0;
		const item = items.at(index);
		if (!item) {
			return {
				success: false,
				reply: `No definition with index ${index}! Maximum available: ${items.length - 1}.`
			};
		}

		const { link, thumbs, content } = prepareItemStrings(item);
		return {
			reply: (typeof context.params.index !== "number" && items.length > 1)
				? `${link} ${thumbs} ${content}`
				: `${thumbs} ${content}`
		};
	}),
	Dynamic_Description: () => [
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
});
