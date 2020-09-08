module.exports = {
	Name: "topgames",
	Aliases: null,
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 60000,
	Description: "Fetches the top 10 most popular games on twitch, based on current viewer count.",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function topGames () {
		const data = await sb.Got.instances.Twitch.Kraken("games/top").json();
		if (!Array.isArray(data.top)) {
			return {
				reply: "No data retrieved..."
			};
		}
	
		const games = data.top.map(i => (
			i.game.name + " (" + sb.Utils.round(i.viewers / 1000, 1) + "k)"
		));
		
		return {
			reply: "Most popular games on Twitch by viewers right now: " + games.join(", ")
		};
	}),
	Dynamic_Description: null
};