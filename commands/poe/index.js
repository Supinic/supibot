module.exports = {
	Name: "poe",
	Aliases: null,
	Author: "supinic",
	Cooldown: 7500,
	Description: "A collection of various Path of Exile related commands. Check the extended help on website for more info.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function poe (context, type, ...args) {
		const { subcommands } = require("./definitions.js");

		type = (type ?? "league").toLowerCase();

		const target = subcommands.find(i => i.name === type || i.aliases.includes(type));
		if (!target) {
			return {
				success: false,
				reply: `Provided subcommand does not exist! Check the command's help: ${this.getDetailURL()}`
			};
		}

		return await target.execute(context, ...args);
	}),
	Dynamic_Description: (async (prefix) => {
		const { subcommands } = require("./definitions.js");

		return [
			"Multiple commands related to Path of Exile.",
			"",

			...subcommands.flatMap(command => [
				`<code>${prefix}poe ${command.name}</code>`,
				command.description,
				""
			])
		];
	})
};
