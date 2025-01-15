const GAMES = {
	league: require("./league")
};

module.exports = {
	Name: "moba",
	Aliases: ["league", "dota"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "This command lets you check many things related to several MOBA games - League of Legends ($league).",
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

		const game = GAMES[context.invocation];
		if (!game) {
			return {
				success: false,
				reply: `This game is not implemented yet!`
			};
		}

		const hasEnvs = game.requiredEnvs.every(key => process.env[key]);
		if (!hasEnvs) {
			throw new sb.Error({
				message: `Missing key(s) for ${context.invocation} (${game.requiredEnvs.join(", ")})`
			});
		}

		const subcommand = game.subcommands.find(i => i.name === type || i.aliases.includes(type));

		// If no subcommand is found, try and find a default one for the current game invocation
		if (!subcommand) {
			const defaultSubcommand = game.subcommands.find(i => i.flags?.default === true);
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
	Dynamic_Description: async () => {
		const list = [];
		for (const [game, definition] of Object.entries(GAMES)) {
			const { addendum, subcommands } = definition;

			list.push(`<h5>$${game}</h5>`);

			for (const subcommand of subcommands) {
				list.push(...subcommand.description, "");
			}

			if (addendum) {
				list.push(...addendum);
			}
		}

		return [
			"This command lets you check many things related to many MOBA games.",
			"",

			...list
		];
	}
};
