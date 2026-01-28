import * as z from "zod";
import { declare } from "../../classes/command.js";

const jokeSchema = z.object({
	id: z.string(),
	joke: z.string()
});
const searchSchema = z.object({
	results: z.array(jokeSchema)
});

export default declare({
	Name: "haHAA",
	Aliases: ["4Head", "4HEad", "HEad"],
	Cooldown: 5000,
	Description: "Posts a random, hilarious joke. A 100% guarantee it's going to be a knee-slapper.",
	Flags: ["mention", "non-nullable", "pipe"],
	Params: [
		{ name: "search", type: "string" }
	],
	Whitelist_Response: null,
	Code: async function fourHead (context) {
		let joke;
		if (context.params.search) {
			const response = await core.Got.get("GenericAPI")({
				url: "https://icanhazdadjoke.com/search",
				searchParams: {
					term: context.params.search,
					limit: "20"
				}
			});

			const jokes = searchSchema.parse(response.body).results;
			if (!Array.isArray(jokes) || jokes.length === 0) {
				return {
					success: false,
					reply: `No jokes found for that search query!`
				};
			}

			joke = core.Utils.randArray(jokes).joke;
		}
		else {
			const response = await core.Got.get("GenericAPI")("https://icanhazdadjoke.com/");
			joke = jokeSchema.parse(response.body).joke;
		}

		const emote = await context.getBestAvailableEmote([context.invocation], "😅");
		return {
			reply: `${joke} ${emote}`
		};
	},
	Dynamic_Description: (prefix) => [
		"Posts a random, 100% hilarious dad joke.",
		"Guaranteed to make you grimace. Definitely a knee-slapper.",
		"",

		`<code>${prefix}4Head</code>`,
		`<code>${prefix}haHAA</code>`,
		"Fetches a random joke. Hilarity will ensue for sure.",
		"",

		`<code>${prefix}4Head <u>search:(search query)</u></code>`,
		`<code>${prefix}4Head <u>search:robot</u></code>`,
		`<code>${prefix}4Head <u>search:"guy walks in"</u></code>`,
		"Fetches a random joke, filtered with your search query. Even more likely to make you giggle."
	]
});
