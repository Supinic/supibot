module.exports = {
	Name: "topgames",
	Aliases: null,
	Author: "supinic",
	Cooldown: 30000,
	Description: "Fetches the top 10 most popular games on twitch, based on current viewer count.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function topGames (context) {
		const response = await sb.Got("Helix", "games/top");
		if (response.statusCode !== 200 || response.body.data.length === 0) {
			return {
				success: false,
				reply: `No data for top games are currently available on Twitch!`
			};
		}

		const emote = await context.getBestAvailableEmote(["Clueless"], "😕 ");
		const games = response.body.data.map(i => i.game.name);
		return {
			reply: `Top categories on Twitch (sorted by viewers ${emote} but Twitch doesn't tell us how many): ${games.join(", ")}`
		};
	}),
	Dynamic_Description: null
};
