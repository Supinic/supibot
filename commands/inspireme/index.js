module.exports = {
	Name: "inspireme",
	Aliases: null,
	Author: "supinic",
	Cooldown: 15000,
	Description: "Inspires you. Randomly.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function inspireMe () {
		const link = await sb.Got("https://inspirobot.me/api?generate=true").text();
		return {
			reply: link
		};
	}),
	Dynamic_Description: null
};
