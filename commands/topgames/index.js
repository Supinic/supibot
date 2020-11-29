module.exports = {
	Name: "topgames",
	Aliases: null,
	Author: "supinic",
	Cooldown: 30000,
	Description: "Fetches the top 10 most popular games on twitch, based on current viewer count.",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function topGames () {
		const data = await sb.Got("Kraken", "games/top").json();
		if (!Array.isArray(data.top)) {
			return {
				success: false,
				reply: "Twitch API returned no data..."
			};
		}
	
		const games = data.top.map(i => (
			i.game.name + " (" + sb.Utils.round(i.viewers / 1000, 1) + "k)"
		));
		
		return {
			reply: "Top categories on Twitch (sorted by viewers): " + games.join(", ")
		};
	}),
	Dynamic_Description: null
};