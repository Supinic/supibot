export default {
	name: "say",
	aliases: ["echo"],
	description: "Simply outputs the input, with no changes.",
	examples: [
		["$abb say hello", "hello"]
	],
	execute: (context, ...args) => ({
		success: true,
		hasExternalInput: true,
		reply: args.join(" ")
	})
};
