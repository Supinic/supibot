module.exports = {
	name: "explode",
	aliases: [],
	description: "Adds a space between all characters of the provided input - then, each one can be used as a specific argument.",
	examples: [
		["$abb explode this is a test", "t h i s i s a t e s t"]
	],
	execute: (context, ...args) => ({
		reply: Array.from(args.join(" "))
			.join(" ")
			.replace(/\s+/g, " ")
	})
};
