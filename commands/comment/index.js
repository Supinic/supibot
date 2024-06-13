module.exports = {
	Name: "comment",
	Aliases: null,
	Author: "supinic",
	Cooldown: 15000,
	Description: "Fetches a random comment from a set of 10 thousand randomly generated YouTube videos.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function comment () {
		const html = await sb.Got("http://www.randomyoutubecomment.com").text();
		const $ = sb.Utils.cheerio(html);
		const comment = $("#comment").text();

		return {
			reply: comment ?? "No comment was available to fetch"
		};
	}),
	Dynamic_Description: null
};
