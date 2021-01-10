module.exports = {
	Name: "gamesdonequick",
	Aliases: ["gdq"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts a Markov chain-generated GDQ speedrun donation message.",
	Flags: ["mention","non-nullable","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function speedrun () {
		const { comment } = await sb.Got("Leppunen", "gdq").json();
		return {
			reply: comment
		};
	}),
	Dynamic_Description: null
};