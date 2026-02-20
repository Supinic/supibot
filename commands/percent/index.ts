import { randomInt } from "../../utils/command-utils.js";
import { declare } from "../../classes/command.js";

export default declare({
	Name: "percent",
	Aliases: ["%"],
	Cooldown: 5000,
	Description: "Rolls a random percentage between 0 and 100%.",
	Flags: ["mention", "pipe", "skip-banphrase"],
	Params: [],
	Whitelist_Response: null,
	Code: function percent () {
		const number = randomInt(0, 10_000);
		return {
			success: true,
			reply: `${number / 100}%`
		};
	},
	Dynamic_Description: (prefix) => [
		"Rolls a random percentage!",
		"",

		`<code>${prefix}%</code>`,
		"Random percentage, between 0.00% to 100.00%"
	]
});
