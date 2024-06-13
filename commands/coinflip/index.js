const { randomInt } = require("../../utils/command-utils.js");

module.exports = {
	Name: "coinflip",
	Aliases: ["cf"],
	Author: "supinic",
	Cooldown: 2500,
	Description: "Flips a coin, and shows you the result of it.",
	Flags: ["mention","pipe","skip-banphrase"],
	Params: [
		{ name: "fail", type: "boolean" }
	],
	Whitelist_Response: null,
	Code: (async function coinflip (context) {
		// According to Murray & Teare (1993), the probability of an American silver nickel landing on its edge is around 1 in 6000 tosses
		const edgeRoll = randomInt(1, 6000);
		if (edgeRoll === 1) {
			return {
				reply: "The coin landed on its edge (!!)"
			};
		}

		const flipRoll = randomInt(1, 2);
		const reply = (flipRoll === 1) ? "Heads (yes)" : "Tails (no)";

		// if the `fail` parameter is `true`, then fail the command with success: false on the "no" result.
		let success = true;
		if (context.params.fail === true) {
			success = (flipRoll === 2);
		}

		return {
			success,
			reply
		};
	}),
	Dynamic_Description: (async (prefix) => [
		"Flips a virtual coin, telling you which side it landed on.",
		"This is determined randomly.",
		"",

		`<code>${prefix}coinflip</code>`,
		`<code>${prefix}cf</code>`,
		"Shows which side the coin landed on."
	])
};
