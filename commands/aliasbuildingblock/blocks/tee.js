export default {
	name: "tee",
	aliases: [],
	description: "Saves the output of the previous command into memory, which can be accessed later. The output is also passed on.",
	examples: [
		["$pipe rl | abb tee", "(random line)"]
	],
	execute: (context, ...args) => {
		const input = args.join(" ");
		if (!input) {
			return {
				success: false,
				reply: `No input provided!`
			};
		}

		context.tee.push(input);

		return {
			reply: input
		};
	}
};
