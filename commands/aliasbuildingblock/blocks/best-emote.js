module.exports = {
	name: "bestavailableemote",
	aliases: ["bae"],
	description: "For a list of emotes, uses the first one that is actually available in the channel. The last one should be a \"fallback\", so it should be available anywhere.",
	examples: [
		["channel with just LULW: $abb bae PepeLaugh pepeLaugh LULW LULE 4Head", "LULW"],
		["channel with no emotes: $abb bae PepeLaugh pepeLaugh LULW LULE 4Head", "4Head"]
	],
	execute: async (context, ...args) => {
		if (args.length < 2) {
			return {
				success: false,
				reply: `At least two emotes must be provided - one to check, one to fall back on!`
			};
		}

		const bestMatch = await context.getBestAvailableEmote(args.slice(0, -1), args[args.length - 1]);
		return {
			reply: bestMatch
		};
	}
};
