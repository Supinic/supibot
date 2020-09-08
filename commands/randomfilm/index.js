module.exports = {
	Name: "randomfilm",
	Aliases: ["rf"],
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 15000,
	Description: "Fetches a random movie.",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function randomFilm () {
		const html = await sb.Got.instances.FakeAgent({
			url: "https://www.bestrandoms.com/random-movie-generator"
		}).text();
	
		const $ = sb.Utils.cheerio(html);
		const movies = $(".list-unstyled.content li").map((ind, i) => {
			const name = $($(i).children()[0]);
			return name.text().replace(/\s+/g, " ");		
		});
	
		return {
			reply: `Your random movie is: ${sb.Utils.randArray(movies)}.`
		};
	}),
	Dynamic_Description: null
};