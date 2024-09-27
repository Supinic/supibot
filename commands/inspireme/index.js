module.exports = {
	Name: "inspireme",
	Aliases: null,
	Author: "supinic",
	Cooldown: 15000,
	Description: "Inspires you. Randomly.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function inspireMe () {
		const response = await sb.Got.get("GenericAPI")({
			url: "https://inspirobot.me/api?generate=true",
			responseType: "text"
		});

		const link = response.body;
		return {
			reply: link
		};
	}),
	Dynamic_Description: null
};
