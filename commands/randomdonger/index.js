const dongers = require("./dongers.json");

module.exports = {
	Name: "randomdonger",
	Aliases: ["rd"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Raise your dongers.",
	Flags: ["mention","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function randomDonger () {
		return {
			reply: sb.Utils.randArray(dongers)
		};
	}),
	Dynamic_Description: null
};
