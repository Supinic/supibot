const { randomInt } = require("../../utils/command-utils.js");

export default {
	Name: "%",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "Rolls a random percentage between 0 and 100%.",
	Flags: ["mention","pipe","skip-banphrase"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function percent () {
		const number = randomInt(0, 10_000);
		return {
			reply: `${number / 100}%`
		};
	}),
	Dynamic_Description: (async (prefix) => [
		"Rolls a random percentage!",
		"",

		`<code>${prefix}%</code>`,
		"Random percentage, between 0.00% to 100.00%"
	])
};
