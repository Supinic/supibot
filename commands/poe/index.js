import subcommands from "./subcommands.js";

export default {
	Name: "poe",
	Aliases: ["poe2"],
	Author: "supinic",
	Cooldown: 7500,
	Description: "A collection of various Path of Exile-related commands. Check the extended help on the website for more info.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function poe (context, type, ...args) {
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
	Dynamic_Description: (async function (prefix) {
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
