module.exports = {
	Name: "botlevels",
	Aliases: ["bots"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts the summary of community bots in #supinic channel on Twitch.",
	Flags: ["skip-banphrase"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function botLevels () {
		return {
			reply: "Bots: https://supinic.com/bot/channel-bots/list // Levels: https://supinic.com/bot/channel-bots/levels // Badges: https://supinic.com/bot/channel-bots/badges"
		};
	}),
	Dynamic_Description: null
};