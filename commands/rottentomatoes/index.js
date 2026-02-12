const APP_ID = "79frdp12pn";
const RESULTS_MAX = 50;
const BASE_SEARCH_PARAMS = new URLSearchParams({
	"x-algolia-api-key": "175588f6e5f8319b27702e4cc4013561",
	"x-algolia-application-id": APP_ID.toUpperCase()
});

module.exports = {
	Name: "rottentomatoes",
	Aliases: ["tomato"],
	Author: "metoo666",
	Cooldown: 5000,
	Description: "Fetches Movie / TV Show scores from Rotten Tomatoes based on the provided query.",
	Flags: ["mention", "pipe"],
	Params: [
		{ name: "year", type: "number" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: async function rottentomatoes (context, ...args) {
		const query = args.join(" ");
		if (!query) {
			return {
				success: false,
				reply: "No query provided!"
			};
		}

		const inputYear = context.params.year;
		if (typeof inputYear === "number" && inputYear > new sb.Date().year) {
			return {
				success: false,
				reply: "Invalid year provided!"
			};
		}

		const response = await sb.Got("GenericAPI", {
			method: "POST",
			url: `https://${APP_ID}-1.algolianet.com/1/indexes/*/queries`,
			searchParams: BASE_SEARCH_PARAMS,
			json: {
				requests: [{
					indexName: "content_rt",
					params: `hitsPerPage=${RESULTS_MAX}`,
					query
				}]
			}
		});

		if (!response.ok) {
			return {
				success: false,
				reply: "Could not fetch data from RottenTomatoes! Try again later."
			};
		}

		const results = response.body.results[0].hits;
		if (results.length === 0) {
			return {
				success: false,
				reply: `No results found for the query provided!`
			};
		}

		const sortedResults = (typeof inputYear === "number")
			? results.sort((a, b) => Math.abs(inputYear - a.releaseYear) - Math.abs(inputYear - b.releaseYear))
			: results.sort((a, b) => b.pageViews_popularity - a.pageViewes_popularity);

		const [target] = sortedResults;
		const { title, releaseYear, type, vanity, rottenTomatoes = {} } = target;
		const { certifiedFresh, audienceScore, criticsScore, criticsIconUrl } = rottenTomatoes;
		const path = (type === "movie") ? "m" : "tv";
		const url = `https://www.rottentomatoes.com/${path}/${vanity}`;

		let rating = "";
		if (certifiedFresh) {
			rating = "🍅";
		}
		else if (criticsIconUrl?.includes("rotten")) {
			rating = "🗑";
		}

		const res = {
			type: (type === "movie") ? "Movie" : "TV Show",
			audienceScore: (audienceScore) ? `${audienceScore}%` : "N/A",
			criticsScore: (criticsScore) ? `${criticsScore}%` : "N/A"
		};

		return {
			reply: sb.Utils.tag.trim `
				Rotten Tomatoes scores for 
				${res.type} ${title} (${releaseYear}):
				${rating}
				Audience: ${res.audienceScore}
				Critics: ${res.criticsScore}
				${url}
			`
		};
	},
	Dynamic_Description: null
};
