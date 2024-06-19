const SUBCOMMANDS = {
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
	Dynamic_Description: async () => {
		const list = [];
		for (const [game, subcommands] of Object.entries(SUBCOMMANDS)) {
			list.push(`<h5>$${game}</h5>`);

			for (const subcommand of subcommands) {
				list.push(...subcommand.description, "");
			}
		}

		return [
			"This command lets you check many things related to many MOBA games.",
			"",

			"To simplify usage for <code>$league</code>, you can use the <code>$set</code> command to set your region and username:",
			"<code>$set league-user (username)</code>",
			"<code>$set league-region (region)</code>",
			`Check more info on the <a href="/bot/command/detail/set">$set command's help page</a>`,
			"",

			"Once you have both of these set up, you can omit the region and username in <code>$league</code> commands.",
			"You can also check someone else's stats by using their username with the <code>@</code> symbol.",
			"<code>$league</code> → Your stats",
			"<code>$league @Username</code> → Another user's stats",
			"",

			...list
		];
	}
};
