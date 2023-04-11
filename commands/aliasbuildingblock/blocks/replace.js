module.exports = {
	name: "replace",
	aliases: [],
	description: "Takes two params: regex, replacement. For the given regex, replaces all matches with the provided value.",
	examples: [
		["$abb replace regex:/a+b/ replacement:lol aaaaaabbb", "lolbb"],
		["$abb replace regex:/foo/ replacement:NaM Damn foo spam", "Damn NaM spam"]
	],
	execute: (context, ...args) => {
		if (!context.params.regex || typeof context.params.replacement !== "string") {
			return {
				success: false,
				reply: `Missing parameter(s)! regex, replacement`
			};
		}

		return {
			reply: args.join(" ")
				.replace(context.params.regex, context.params.replacement)
		};
	}
};
