import subcommands from "./subcommands/index.js";
const subcommandNames = subcommands.map(i => i.name);

export default {
	Name: "badapplerendition",
	Aliases: ["badapple", "bar"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Aggregate command for anything regarding the Bad Apple!! rendition list on the website.",
	Flags: ["mention","pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: async function badAppleRendition (context, commandName, ...args) {
		if (!commandName) {
			return {
				success: false,
				reply: `No command provided! Use one of these: ${subcommandNames.join(", ")}`
			};
		}

		const subcommand = subcommands.find(i => i.name === commandName || i.aliases.includes(commandName));
		if (!subcommand) {
			return {
				success: false,
				reply: `Unknown command provided! Use one of these: ${subcommandNames.join(", ")}`
			};
		}

		return await subcommand.execute(context, ...args);
	},
	Dynamic_Description: () => {
		const subcommandList = subcommands.map(i => {
			if (!i.aliases || i.aliases.length === 0) {
				return `<code>$bar ${i.name}</code>\n${i.description}`;
			}
			else {
				const invocations = [i.name, ...i.aliases].map(invocation => `<code>$bar ${invocation}</code>`).join("\n");
				return `${invocations}\n${i.description}`;
			}
		});

		return [
			"Aggregate command for all things Bad Apple!! related.",
			"",

			...subcommandList
		];
	}
};
