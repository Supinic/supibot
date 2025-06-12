export default {
	Name: "comment",
	Aliases: null,
	Author: "supinic",
	Cooldown: 15000,
	Description: "Fetches a random comment from a set of 10 thousand randomly generated YouTube videos.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function comment () {
		const response = await core.Got.get("FakeAgent")({
			url: "http://www.randomyoutubecomment.com",
			responseType: "text"
		});

		const $ = core.Utils.cheerio(response.body);
		const comment = $("#comment").text();

		return {
			reply: comment ?? "No comment was available to fetch"
		};
	}),
	Dynamic_Description: null
};
