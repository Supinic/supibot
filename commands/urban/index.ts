import { declare } from "../../classes/command.ts";
import * as z from "zod";
import { SupiError } from "supi-core";
import { logger } from "../../singletons/logger.ts";

const URBAN_FAUX_ACCESS_KEY = "ab71d33b15d36506acf1e379b0ed07ee";
const urbanResponseSchema = z.object({
	list: z.array(
		z.object({
			author: z.string(),
			current_vote: z.string(),
			defid: z.int(),
			definition: z.string(),
			example: z.string(),
			permalink: z.string(),
			thumbs_down: z.int(),
			thumbs_up: z.int(),
			word: z.string(),
			written_on: z.iso.datetime()
		})
	)
});
type UrbanItem = z.infer<typeof urbanResponseSchema>["list"][number];

const prepareItemStrings = (item: UrbanItem) => {
	const url = new URL(item.permalink);
	// const id = url.pathname.replace("/", ""); // Looks like this no longer works as of cca. 2025-07-06
	const id = url.searchParams.get("defid");
	if (!id) {
		throw new SupiError({ message: "No defid found in Urban URL" });
	}

	const link = `https://urbanup.com/${id}`;
	const thumbs = `(+${item.thumbs_up}/-${item.thumbs_down})`;
	const example = (item.example)
		? ` - Example: ${item.example}`
		: "";

	const content = (item.definition + example).replaceAll(/[\][]/g, "");
	return { link, content, thumbs };
};

/**
 * Here is a guideline for the current API to obtain votes:
 * For the given definition IDs, a hex signature is required. The signature is unique for combination of IDs and is order-specific
 * Possible way to get this:
 * 1) Do the fetching as normal, obtain the result item ID
 * 2) Scrape https://urbanup.com/${id}
 * 3) Look for <body> attribute "...signature" and the item IDs related to it
 * 4A) Fetch https://www.urbandictionary.com/api/vote?defids=(comma separated list))&signature=(signature))
 * 4B) Just scrape the HTML from 2) - attributes data-x-text=upCount/downCount
 */

export default declare({
	Name: "urban",
	Aliases: null,
	Cooldown: 10000,
	Description: "Fetches the top definition of a given term from Urban Dictionary. You can append \"index:#\" at the end to access definitions that aren't first in the search.",
	Flags: ["external-input", "mention", "non-nullable", "pipe"],
	Params: [
		{ name: "index", type: "number" }
	],
	Whitelist_Response: null,
	Code: (async function urban (context, ...args) {
		if (args.length === 0 || args[0] === "random") {
			const randomResponse = await core.Got.get("GenericAPI")({
				url: "https://api.urbandictionary.com/v0/random"
			});

			const { list } = urbanResponseSchema.parse(randomResponse.body);
			const firstItem = list[0];
			const { link, thumbs, content } = prepareItemStrings(firstItem);

			return {
				success: true,
				reply: `${firstItem.word}: ${link} ${thumbs} ${content}`
			};
		}

		const term = args.join(" ").toLowerCase();
		const response = await core.Got.get("GenericAPI")({
			url: "https://api.urbandictionary.com/v0/define",
			searchParams: {
				api_key: URBAN_FAUX_ACCESS_KEY,
				term
			},
			throwHttpErrors: false,
			retry: { limit: 0 },
			timeout: { request: 10_000 }
		});

		if (!response.ok) {
			return {
				success: false,
				reply: "Urban Dictionary is currently overloaded! Try again later."
			};
		}

		const { data } = urbanResponseSchema.safeParse(response.body);
		if (!data) {
			const string = JSON.stringify(response.body);
			void logger.log("Command.Warning", `Urban Dictionary zod parse failure: ${string}`, context.channel, context.user);

			return {
				success: false,
				reply: "Urban Dictionary is currently overloaded! Try again later."
			};
		}

		const items = data.list
			.filter(i => i.word.toLowerCase() === args.join(" ").toLowerCase())
			.sort((a, b) => b.thumbs_up - a.thumbs_up);

		if (items.length === 0) {
			return {
				success: false,
				reply: "No such definition exists!"
			};
		}

		const index = context.params.index ?? 0;
		const item = items.at(index);
		if (!item) {
			return {
				success: false,
				reply: `No definition with index ${index}! Maximum available: ${items.length - 1}.`
			};
		}

		const { link, content } = prepareItemStrings(item);
		return {
			reply: (typeof context.params.index !== "number" && items.length > 1)
				? `${link} ${content}`
				: content
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
