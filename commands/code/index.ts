import { declare } from "../../classes/command.js";

export default declare({
	Name: "code",
	Aliases: null,
	Author: "supinic",
	Cooldown: 2500,
	Description: "Posts a link to a specific command's code definition on GitHub.",
	Flags: ["developer","mention","pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: (function code (context, commandString) {
		if (!commandString) {
			return {
				success: false,
				reply: "No command provided!"
			};
		}

		const command = sb.Command.get(commandString);
		if (!command) {
			return {
				success: false,
				reply: "Provided command does not exist!"
			};
		}

		const url = command.getDetailURL({ useCodePath: true });
		return {
			reply: `GitHub link: ${url}`
		};
	}),
	Dynamic_Description: null
});
