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
	Static_Data: null,
	Code: (async function roll (context, ...args) {
		if (args.length === 0) {
			const result = sb.Utils.random(1, 100);
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

		let [first, second] = args;
		if (first && second) {
			first = Number(first);
			second = Number(second);

			if (!Number.isInteger(first) || !Number.isInteger(second)) {
				return {
					success: false,
					reply: "You must use integers as the roll boundaries!"
				};
			}
			else if (first > Number.MAX_SAFE_INTEGER || second > Number.MAX_SAFE_INTEGER) {
				return {
					success: false,
					reply: "That number is too large!"
				};
			}
			else if (first < Number.MIN_SAFE_INTEGER || second < Number.MIN_SAFE_INTEGER) {
				return {
					success: false,
					reply: "That negative number is too large!"
				};
			}

			const number = sb.Utils.random(first, second);
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
		const result = sb.Utils.evalDiceRoll(fixedInput, 1_000_000);

		if (result === null) {
			return {
				success: false,
				reply: "Cannot make this roll work! 🙁"
			};
		}
		else if (result === Infinity) {
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
