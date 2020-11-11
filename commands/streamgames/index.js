module.exports = {
	Name: "streamgames",
	Aliases: ["games","sg"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Posts the link to supinic's stream game list on the website.",
	Flags: ["developer","mention","pipe","system","whitelist"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function streamGames () {
		return {
			reply: `Check out supi's stream game list here! https://supinic.com/stream/game/list`
		};
	}),
	Dynamic_Description: null
};