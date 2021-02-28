module.exports = {
	Name: "topemotestoday",
	Aliases: ["tet"],
	Author: "supinic",
	Cooldown: 20000,
	Description: "Posts the top 10 used emotes on Twitch for a given day.",
	Flags: ["mention","non-nullable"],
	Params: [
		{ name: "date", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function topEmotesToday (context) {
		const date = (context.params.date)
			? new sb.Date(context.params.date)
			: new sb.Date();

		if (!date) {
			return {
				success: false,
				reply: "Invalid date provided!"
			};
		}

		const data = await sb.Got("GenericAPI", {
			url: "https://internal-api.twitchemotes.com/api/stats/top/by-date",
			searchParams: new sb.URLParams()
				.set("limit", "10")
				.set("date", date.format("Y-m-d"))
				.toString()
		}).json();

		if (data.length === 0) {
			return {
				success: false,
				reply: "That day has no top-emotes data available!"
			};
		}
		return {
			reply: data
				.sort((a, b) => b.count - a.count)
				.map((i, ind) => `#${ind + 1}: ${i.code} - ${sb.Utils.formatSI(i.count, "", 2)}`)
				.join("; ")
		};
	}),
	Dynamic_Description: null
};