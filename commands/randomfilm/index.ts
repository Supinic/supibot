import { declare } from "../../classes/command.js";

export default declare({
	Name: "randomfilm",
	Aliases: ["rf"],
	Cooldown: 15000,
	Description: "Fetches a random movie.",
	Flags: ["mention", "non-nullable", "pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: async function randomFilm () {
		const html = await core.Got.get("FakeAgent")({
			url: "https://www.bestrandoms.com/random-movie-generator",
			responseType: "text"
		}).text();

		const $ = core.Utils.cheerio(html);
		const movies = $(".content .list-unstyled li").map((ind, i) => {
			const name = $($(i).children()[2]);
			return name.text()
				.replaceAll(/\s+/g, " ")
				.replace(/(\(\d+\))/, " $1");
		});

		const movie = core.Utils.randArray([...movies]);
		return {
			success: true,
			reply: `Your random movie: ${movie}.`
		};
	},
	Dynamic_Description: null
});
