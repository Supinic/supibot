const { randomBytes } = require("node:crypto");
const { roll: diceRoll } = require("roll-dice");
const { randomInt } = require("../../utils/command-utils.js");

module.exports = {
	Name: "roll",
	Aliases: ["dice"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Rolls a random number. If nothing is specified, rolls 1-100. You can specify min and max values, or some expression using standard dice notation.",
	Flags: ["mention","pipe","skip-banphrase"],
	Params: [
		{ name: "textOnly", type: "boolean" }
	],
	Whitelist_Response: null,
	Code: (async function roll (context, ...args) {
		if (args.length === 0) {
			const result = randomInt(1, 100);
			if (context.params.textOnly) {
				return {
					reply: String(result)
				};
			}
			else {
				return {
					reply: `Your roll is ${result}.`
				};
			}
		}

		const firstNum = Number(args[0]);
		const secondNum = Number(args[1]);
		if (args[0] && args[1] && Number.isInteger(firstNum) && Number.isInteger(secondNum)) {
			if (firstNum > Number.MAX_SAFE_INTEGER || secondNum > Number.MAX_SAFE_INTEGER) {
				return {
					success: false,
					reply: "That number is too large!"
				};
			}
			else if (firstNum < Number.MIN_SAFE_INTEGER || secondNum < Number.MIN_SAFE_INTEGER) {
				return {
					success: false,
					reply: "That negative number is too large!"
				};
			}

			const number = (firstNum < secondNum)
				? randomInt(firstNum, secondNum)
				: randomInt(secondNum, firstNum);

			if (context.params.textOnly) {
				return {
					reply: String(number)
				};
			}
			else {
				return {
					reply: `Your roll is ${number}.`
				};
			}
		}

		const [fixedInput] = args.join(" ").split(/[a-ce-zA-Z]/);
		const hexStringSeed = randomBytes(64).toString("hex");
		const seed = BigInt(`0x${hexStringSeed}`);

		let result;
		try {
			result = diceRoll(fixedInput, seed, 1_000_000n);
		}
		catch (e) {
			const message = e?.message ?? String(e);
			return {
				success: false,
				reply: `Cannot make this roll work! Error: ${message}`
			};
		}

		if (result === Infinity) {
			return {
				reply: "INFINITY WAYTOODANK"
			};
		}
		else if (context.params.textOnly) {
			return {
				reply: String(result)
			};
		}
		else {
			return {
				reply: `Your roll is ${result}.`
			};
		}
	}),
	Dynamic_Description: (async (prefix) => [
		"Rolls a random number.",
		"You can use multiple ways to determine the limits of your rolls.",
		"If you add the <code>textOnly:true</code> parameter, only the roll will be the output, without the surrounding text.",
		"",

		`<code>${prefix}roll</code>`,
		"Rolls between 1 and 100.",
		"",

		`<code>${prefix}roll (low) (high)</code>`,
		`<code>${prefix}roll 153 344</code>`,
		"Rolls between (low) and (high) numbers, inclusively.",
		"",

		`<code>${prefix}roll 1d100</code>`,
		`<code>${prefix}roll 5d25</code>`,
		`<code>${prefix}roll (1d5)d(25d100)</code>`,
		"Rolls using DnD dice format."
	])
};
