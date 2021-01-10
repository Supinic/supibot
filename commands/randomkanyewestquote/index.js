module.exports = {
	Name: "randomkanyewestquote",
	Aliases: ["rkwq"],
	Author: "supinic",
	Cooldown: 15000,
	Description: "Posts a random Kanye West quote.",
	Flags: ["mention","non-nullable","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function randomKanyeWestQuote () {
		const { quote } = await sb.Got("https://api.kanye.rest").json();
		return {
			reply: quote
		};
	}),
	Dynamic_Description: null
};