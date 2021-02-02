module.exports = {
	Name: "about",
	Aliases: null,
	Author: "supinic",
	Cooldown: 60000,
	Description: "Posts a summary of what supibot does, and what it is.",
	Flags: ["mention","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function about () {
		return {	
			reply: "Supibot is a smol variety and utility bot supiniL running on a smol Raspberry Pi 3B supiniL not primarily designed for moderation supiniHack running on Node.js since Feb 2018."
		};
	}),
	Dynamic_Description: null
};