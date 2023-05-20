module.exports = {
	name: "help",
	aliases: [],
	description: [
		"Shows a brief description of the subcommands."
	],
	execute: async () => ({
		reply: sb.Utils.tag.trim `
			Use one of these:
			$fish → go fishing;
			$fish (bait) → buy bait and go fishing;
			$fish sell (fish) → sell one of your fish;
			$fish show → show off your collection;
			$fish help → you're reading this.
		`
	})
};
