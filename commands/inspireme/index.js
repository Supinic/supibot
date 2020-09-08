module.exports = {
	Name: "inspireme",
	Aliases: null,
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 15000,
	Description: "Inspires you. Randomly.",
	Flags: ["mention","pipe"],
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