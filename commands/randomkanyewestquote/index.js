module.exports = {
	Name: "randomkanyewestquote",
	Aliases: ["rkwq"],
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 15000,
	Description: "Posts a random Kanye West quote.",
	Flags: ["mention","pipe"],
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