module.exports = {
	Name: "fish",
	Aliases: [],
	Author: [
		"2547techno",
		"techno_______",
		"futurecreep",
		"chusnek"
	],
	Cooldown: 5000,
	Description: "Go fishing!",
	Flags: ["mention","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function fish (context, ...args) {
		const { subcommands } = require("./subcommands/index.js");
		const [subcommandName, ...rest] = args;

		const subcommand = subcommands.find(i => i.name === subcommandName || i.aliases.includes(subcommandName));
		if (subcommand) {
			return await subcommand.execute(context, ...rest);
		}
		else {
			const defaultSubcommand = subcommands.find(i => i.default);
			return await defaultSubcommand.execute(context, subcommandName, ...rest);
		}
	}),
	Dynamic_Description: null
};
