export default {
	Name: "topgames",
	Aliases: null,
	Author: "supinic",
	Cooldown: 30000,
	Description: "Fetches the top 10 most popular games on Twitch, based on current viewer count.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function topGames (context) {
		const response = await core.Got.get("Helix")("games/top");
		if (response.statusCode !== 200 || response.body.data.length === 0) {
			return {
				success: false,
				reply: `No data for top games are currently available on Twitch!`
			};
		}

		const emote = await context.getBestAvailableEmote(["Clueless"], "😕 ");
		const games = response.body.data.map(i => i.name);
		return {
			reply: `Top categories on Twitch (sorted by viewers ${emote} but Twitch doesn't tell us how many): ${games.join(", ")}`
		};
	}),
	Dynamic_Description: null
};
