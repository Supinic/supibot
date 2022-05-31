module.exports = {
	Name: "check",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Checks certain user or system variables. For a list of types, check the command's extended help.",
	Flags: ["mention","pipe","use-params"],
	Params: [
		{ name: "index", type: "number" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function check (context, type, identifier) {
		if (!type) {
			return {
				success: false,
				reply: `No type provided! Check here for more info: ${this.getDetailURL()}`
			};
		}

		this.data.subcommands ??= require("./subcommands.js")(this);

		const subcommand = this.data.subcommands.find(i => i.name === type || i.aliases.includes(type));
		if (!subcommand) {
			return {
				success: false,
				reply: `Invalid type provided! Check here for more info: ${this.getDetailURL()}`
			};
		}

		return await subcommand.execute(context, identifier);
	}),
	Dynamic_Description: (async (prefix) => {
		const getCommands = require("./subcommands.js");

		// no need to pass the command itself as param, since no subcommands are executed
		const subcommands = getCommands(null);
		const list = subcommands.map(i => {
			const aliases = (i.aliases && i.aliases.length > 0)
				? ` (${i.aliases.join(", ")})`
				: "";

			return `<li><code>${i.name}${aliases}</code> - ${i.description}</li>`;
		});

		return [
			"Checks variables that you have been set within Supibot",
			"",

			`<code>${prefix}check (variable)</code>`,
			"Checks the status of a given variable.",
			"",

			"Supported types:",
			`<ul>${list.join("")}</ul>`
		];
	})
};
