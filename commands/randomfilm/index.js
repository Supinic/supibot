module.exports = {
	Name: "randomfilm",
	Aliases: ["rf"],
	Author: "supinic",
	Cooldown: 15000,
	Description: "Fetches a random movie.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function randomFilm () {
		const html = await sb.Got.get("FakeAgent")({
			url: "https://www.bestrandoms.com/random-movie-generator",
			responseType: "text"
		}).text();

		const $ = sb.Utils.cheerio(html);
		const movies = $(".content .list-unstyled li").map((ind, i) => {
			const name = $($(i).children()[2]);
			return name.text()
				.replaceAll(/\s+/g, " ")
				.replace(/(\(\d+\))/, " $1");
		});

		return {
			reply: `Your random movie is: ${sb.Utils.randArray(movies)}.`
		};
	}),
	Dynamic_Description: null
};
