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
					reply: "That's too much."
				};
			}
	
			const number = sb.Utils.random(first, second);
			if (context.append.pipe) {
				return { reply: String(number ) };
			}
			else {
				return { reply: `Your specific roll (no dice) is ${number}.` };
			}
		}

		try {
			const result = sb.Utils.evalDiceRoll(args.join(""), 1.0e6);

			if (result === Infinity) {
				return { reply: "WAYTOODANK" };
			} 
			else if (context.append.pipe) {
				return { reply: String(result) };
			} 
			else {
				return { reply: `Your roll is ${result}` };
			}
		} catch (error) {
			if (context.append.pipe) {
				return { reply: String(error.message), success: false };
			} 
			else {
				return { reply: `WAYTOODANK ${error.message}` };
			}
		}
	}),
	Dynamic_Description: null
};