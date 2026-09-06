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
		const response = await core.Got.get("FakeAgent")({
			url: "https://www.bestrandoms.com/random-movie-generator",
			responseType: "text"
		});

		const $ = core.Utils.cheerio(response.body);
		const movies = [...$(".movie-card-title")].map(i => {
			const text = $(i).text();
			return text.replaceAll(/\s+/g, " ").replace(/(\(\d+\))/, " $1");
		});

		if (movies.length === 0) {
			return {
				success: false,
				reply: "No random movies are available at the moment! Try again later."
			};
		}

		const movie = core.Utils.randArray([...movies]);
		return {
			success: true,
			reply: `Your random movie: ${movie}.`
		};
	},
	Dynamic_Description: null
});
