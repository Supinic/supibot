module.exports = {
	Name: "haHAA",
	Aliases: ["4Head","4HEad","HEad"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Posts a random, hilarious joke, 100% guaranteed.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [
		{ name: "search", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function _4head (context) {
		let joke;
		if (context.params.search) {
			const response = await sb.Got("GenericAPI", {
				url: "https://icanhazdadjoke.com/search",
				searchParams: {
					term: context.params.search,
					limit: "20"
				}
			});

			const jokes = response.body.results;
			if (!Array.isArray(jokes) || jokes.length === 0) {
				return {
					success: false,
					reply: `No jokes found for that search query!`
				};
			}

			joke = sb.Utils.randArray(jokes).joke;
		}
		else {
			const response = await sb.Got("GenericAPI", "https://icanhazdadjoke.com/");
			joke = response.body.joke;
		}

		const emote = await context.getBestAvailableEmote([context.invocation], "😅");
		return {
			reply: `${joke} ${emote}`
		};
	}),
	Dynamic_Description: (async (prefix) => [
		"Posts a random, 100% hilarious dad joke.",
		"Guaranteed to make you grimace",
		"",

		`<code>${prefix}4Head</code>`,
		`<code>${prefix}haHAA</code>`,
		"Fetches a completely random joke.",
		"",

		`<code>${prefix}4Head <u>search:(search query)</u></code>`,
		`<code>${prefix}4Head <u>search:robot</u></code>`,
		`<code>${prefix}4Head <u>search:"guy walks in"</u></code>`,
		"Fetches a random joke, filtered with your search query."
	])
};
