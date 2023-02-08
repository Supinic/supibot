module.exports = {
	Name: "streamgames",
	Aliases: ["games","sg"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Posts the link to Supinic's stream game list on the website.",
	Flags: ["developer","mention","pipe","system","whitelist"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function streamGames () {
		return {
			reply: `Check out supi's stream game list here! https://supinic.com/stream/game/list`
		};
	}),
	Dynamic_Description: null
};
