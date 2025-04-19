import dongers from "./dongers.json" with { type: "json" };

export default {
	Name: "randomdonger",
	Aliases: ["rd"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Raise your dongers.",
	Flags: ["mention","pipe"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function randomDonger () {
		return {
			reply: core.Utils.randArray(dongers)
		};
	}),
	Dynamic_Description: null
};
