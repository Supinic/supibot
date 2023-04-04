export const definition = {
	name: "argumentsCheck",
	aliases: ["ac", "argCheck"],
	description: "Takes a number range - expected amount of arguments as first argument. If the amount of actual arguments falls in the range, simply returns output; if not, returns an error. You can specify a custom error message with the parameter em/errorMessage, where your underscores will be replaced by spaces.",
	examples: [
		["$abb argCheck 3 a b c", "a b c"],
		["$abb ac 1..5 a b c", "a b c"],
		["$abb ac ..2 a b c", "Error! ..2 arguments expected, got 3"],
		["$abb ac 5.. a", "Error! 5.. arguments expected, got 1"],
		["$abb ac 2 foo", "Error! Expected 2 arguments, got 1"],
		["$abb ac errorMessage:\"No I don't think so\" 2 foo", "Error! No I don't think so"]
	],
	execute: (context, limit, ...args) => {
		if (!limit) {
			return {
				success: false,
				reply: `No argument limit provided!`
			};
		}

		const range = limit.split("..").map(i => i === "" ? null : Number(i));
		if (range.length === 0) { // ".." - interpreted as "any"
			return {
				reply: args.join(" ")
			};
		}
		else if (range.some(i => i !== null && !sb.Utils.isValidInteger(i))) {
			return {
				success: false,
				reply: `Invalid arguments range provided`
			};
		}

		range[0] = range[0] ?? 0;
		if (range[1] === null) {
			range[1] = Infinity;
		}
		else if (typeof range[1] === "undefined") {
			range[1] = range[0];
		}

		if (range[0] > range[1]) {
			return {
				success: false,
				reply: `Lower argument range bound must not be greater than the upper one!`
			};
		}
		else if (range[0] <= args.length && args.length <= range[1]) {
			return {
				reply: args.join(" ")
			};
		}
		else {
			const reply = (
				context.params.em
				?? context.params.errorMessage
				?? `Expected ${limit} arguments, got ${args.length} instead!`
			);

			return {
				success: false,
				reply,
				forceExternalPrefix: true
			};
		}
	}
};
