module.exports = {
	Name: "supibotfunfact",
	Aliases: ["sff"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "TODO",
	Flags: ["non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function supibotFunFact (context, commandName) {
		let command;
		if (commandName) {
			command = sb.Command.get(commandName);

			if (!command) {
				return {
					success: false,
					reply: `TODO bad command`
				};
			}
			else if (!command.Dynamic_Description) {
				return {
					success: false,
					reply: `TODO No advanced description`
				};
			}
		}
		else {
			const eligibleCommands = sb.Command.data.filter(i => i.Dynamic_Description);
			command = sb.Utils.randArray(eligibleCommands);
		}

		const longDescription = await command.Dynamic_Description(sb.Command.prefix);
		const commandDocs = sb.Utils.tag.trim `
			Command: $${command.Name};
			Summary: ${command.Description ?? "N/A"}
			Description: ${longDescription}
		`;

		const response = await sb.Got("GenericAPI", {
			method: "POST",
			url: `https://api.deepinfra.com/v1/inference/mistralai/Mixtral-8x7B-Instruct-v0.1`,
			headers: {
				Authorization: `Bearer ${sb.Config.get("API_KEY_DEEPINFRA")}`
			},
			json: {
				input: sb.Utils.tag.trim `
					[INST] 
					Generate a fun fact about a chat bot Supibot's command ${command.Name}.
					Try and generate info about a single subcommand, along with its usage example.
					Make it concise, fit within 300 characters.
					Command documentation: ${commandDocs}
					[/INST]
				`,
				max_new_tokens: 300,
				temperature: 0.75
			}
		});

		const text = response.body.results[0].generated_text;
		return {
			reply: `ℹ ${text}`
		};
	}),
	Dynamic_Description: null
};
