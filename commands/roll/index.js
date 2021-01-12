module.exports = {
	Name: "roll",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "Rolls a random number. If nothing is specified, rolls 1-100. You can specify min and max values, or some expression using standard dice notation.",
	Flags: ["mention","pipe","skip-banphrase"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function roll (context, ...args) {
		if (args.length === 0) {
			const result = sb.Utils.random(1, 100);
			if (context.append.pipe) {
				return { reply: String(result) };
			} 
			else {
				return { reply: `Your roll is ${result}.` };
			}
		}

		let [first, second] = args;
		if (Number(first) && Number(second)) {
			first = Number(first);
			second = Number(second);
	
			if (first > Number.MAX_SAFE_INTEGER || second > Number.MAX_SAFE_INTEGER) {
				return {
					success: false,
					reply: "That's too much."
				};
			}
	
			const number = sb.Utils.random(first, second);
			if (context.append.pipe) {
				return { reply: String(number) };
			}
			else {
				return { reply: `Your specific roll (no dice) is ${number}.` };
			}
		}

		const [fixedInput] = args.join(" ").split(/[a-ce-zA-Z]/)
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
		else if (context.append.pipe) {
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
	Dynamic_Description: null
};