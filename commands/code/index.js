export default {
	Name: "code",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "Posts a link to a specific command's code definition on GitHub.",
	Flags: ["developer","mention","pipe"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function code (context, commandString) {
		if (!commandString) {
			return {
				success: false,
				reply: "No command provided!",
				cooldown: 2500
			};
		}

		const command = sb.Command.get(commandString);
		if (!command) {
			return {
				success: false,
				reply: "Provided command does not exist!",
				cooldown: 2500
			};
		}

		const url = command.getDetailURL({ useCodePath: true });
		return {
			reply: `GitHub link: ${url}`
		};
	}),
	Dynamic_Description: null
};
