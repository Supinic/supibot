import subcommands from "./subcommands/index.js";
const subcommandNames = subcommands.map(i => i.name);

export default {
	Name: "faceit",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Command for everything related to CS:GO within FACEIT",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function faceit (context, subcommandName, ...args) {
		if (!process.env.API_FACEIT_KEY) {
			throw new sb.Error({
				message: "No FaceIt key configured (API_FACEIT_KEY)"
			});
		}

		const subcommand = subcommands.find(i => i.name === subcommandName || i.aliases?.includes(subcommandName));
		if (!subcommand) {
			return {
				success: false,
				reply: `Unrecognized subcommand! Use one of: ${subcommandNames.join(", ")}`
			};
		}

		return await subcommand.execute(context, ...args);
	}),
	Dynamic_Description: async function () {
		const commandDescriptions = subcommands.flatMap(i => [
			`<h6>${i.name}</h6>`,
			...i.description,
			""
		]);

		return [
			"An aggregate command for everything related to the FACEIT platform for Counter Strike: Global Offensive",
			"",

			...commandDescriptions
		];
	}
};
