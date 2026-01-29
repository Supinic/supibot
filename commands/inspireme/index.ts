import { declare } from "../../classes/command.js";

export default declare({
	Name: "inspireme",
	Aliases: null,
	Cooldown: 15000,
	Description: "Inspires you. Randomly.",
	Flags: ["mention", "non-nullable", "pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: async function inspireMe () {
		const response = await core.Got.get("GenericAPI")({
			url: "https://inspirobot.me/api?generate=true",
			responseType: "text"
		});

		const link = response.body;
		return {
			success: true,
			reply: link
		};
	},
	Dynamic_Description: null
});
