export const definition = {
	name: "platform",
	aliases: [],
	description: "Prints the name of the current platform.",
	examples: [
		["$abb platform", "twitch"]
	],
	execute: (context) => ({
		reply: context.platform.Name
	})
};
