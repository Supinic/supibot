const SUBCOMMANDS = {
	dota: require("./dota"),
	league: require("./league")
};

module.exports = {
	Name: "moba",
	Aliases: ["league", "dota"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "WIP",
	Flags: ["mention","pipe","skip-banphrase"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function moba (context, type, ...args) {
		if (context.invocation === "moba") {
			return {
				success: false,
				reply: `Use one of the command aliases directly!`
			};
		}

		const subcommands = SUBCOMMANDS[context.invocation];
		if (!subcommands) {
			return {
				success: false,
				reply: `This game is not implemented yet!`
			};
		}

		const subcommand = subcommands.find(i => i.name === type || i.aliases.includes(type));

		// If no subcommand is found, try and find a default one for the current game invocation
		if (!subcommand) {
			const defaultSubcommand = subcommands.find(i => i.flags?.default === true);
			if (defaultSubcommand) {
				return await defaultSubcommand.execute(context, defaultSubcommand.name, type, ...args);
			}
			else {
				return {
					success: false,
					reply: `No such subcommand exists for ${context.invocation}!`
				};
			}
		}
		else {
			return await subcommand.execute(context, type, ...args);
		}
	}),
	Dynamic_Description: null
};
