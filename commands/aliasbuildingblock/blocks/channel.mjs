export const definition = {
	name: "channel",
	aliases: [],
	description: "Prints the current channel, or \"(none\") if in PMs.",
	examples: [
		["$abb channel", "(current channel)"]
	],
	execute: (context) => ({
		reply: context.channel?.Name ?? "(none)"
	})
};
