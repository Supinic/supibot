export default {
	name: "executor",
	aliases: ["self"],
	description: "Prints your username.",
	examples: [
		["$abb executor", "(you)"]
	],
	execute: (context) => ({
		reply: context.user.Name
	})
};
