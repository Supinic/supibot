module.exports = {
	Name: "faceit",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Command for everything related to CS:GO within FACEIT",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function faceit (context, subcommandName, ...args) {
		const { names, commands } = require("./subcommands.js");
		const subcommand = commands.find(i => i.name === subcommandName || i.aliases.includes(subcommandName));
		if (!subcommand) {
			return {
				success: false,
				reply: `Unrecognized subcommand! Use one of: ${names.join(", ")}`
			};
		}

		return await subcommand.execute(context, ...args);
	}),
	Dynamic_Description: (async function (prefix) {
		const { commands } = require("./subcommands.js");
		const commandDescriptions = commands.flatMap(i => [
			`<h6>${i.name}</h6>`,
			...i.getDescription(prefix),
			""
		]);

		return [
			"An aggregate command for everything related to the FACEIT platform for Counter Strike: Global Offensive",
			"",

			...commandDescriptions
		];
	})
};
