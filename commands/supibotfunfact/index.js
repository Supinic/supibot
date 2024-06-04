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
			throwHttpErrors: false,
			responseType: "text",
			url: "https://nexra.aryahcr.cc/api/chat/gpt",
			json: {
				messages: [],
				model: "gpt-4-32k",
				prompt: sb.Utils.tag.trim `
					Post an interesting tidbit about a chat bot Supibot's command ${command.Name}.
					Try and generate info about a specific subcommand, along with its usage example.
					If a command has no subcommands, generate a command summary. 
					Don't make it quirky, don't include emojis, hashtags, that sort.
					Make it concise, fit within 300 characters.
					Command documentation: ${commandDocs}
				`,
				markdown: false,
				top_p: 1,
				frequency_penalty: 0,
				presence_penalty: 0
			}
		});

		const index = response.body.indexOf("{");
		if (index === -1) {
			return {
				success: false,
				reply: `Nexra API returned an invalid response! Try again later.`
			};
		}

		try {
			response.body = JSON.parse(response.body.slice(index));
		}
		catch (e) {
			return {
				success: false,
				reply: `Nexra API returned an invalid response! Try again later.`
			};
		}


		return {
			reply: `ℹ ${response.body.gpt}`
		};
	}),
	Dynamic_Description: null
};
