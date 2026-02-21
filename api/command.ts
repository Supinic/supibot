import type { ApiDefinition } from "./index.js";

export default {
	prefix: () => ({
		statusCode: 200,
		data: {
			prefix: sb.Command.prefix
		}
	}),

	execute: async (req, res, url) => {
		const invocation = url.searchParams.get("invocation");
		if (!invocation) {
			return {
				statusCode: 400,
				error: { message: `Valid command invocation must be provided` }
			};
		}

		const rawArguments = url.searchParams.get("arguments");
		const args = (rawArguments ?? "").split(" ");

		const platform = url.searchParams.get("platform") ?? "twitch";
		const channel = url.searchParams.get("channel");
		const user = url.searchParams.get("user");
		if (!channel || !user) {
			return {
				statusCode: 400,
				error: { message: `Missing user and/or channel identifiers` }
			};
		}

		const platformData = sb.Platform.get(platform);
		if (!platformData) {
			return {
				statusCode: 400,
				error: { message: `Valid platform must be provided` }
			};
		}

		const channelData = sb.Channel.get(channel, platformData) ?? null;
		const userData = await sb.User.get(user, true) ?? null;
		if (!userData) {
			return {
				statusCode: 400,
				error: { message: `Valid user must be provided` }
			};
		}

		const execution = await sb.Command.checkAndExecute({
			command: invocation,
			args,
			channel: channelData,
			user: userData,
			platform: platformData,
			platformSpecificData: null,
			options: {
				skipGlobalBan: url.searchParams.has("skipGlobalBan")
			}
		});

		return {
			statusCode: 200,
			data: {
				result: {
					success: execution.success ?? true,
					reply: execution.reply ?? null
				}
			}
		};
	},

	info: async (req, res, url) => {
		const commandName = url.searchParams.get("command");
		if (!commandName) {
			return {
				statusCode: 400,
				error: { message: `Command name must be provided` }
			};
		}

		const commandData = sb.Command.get(commandName);
		if (!commandData) {
			return {
				statusCode: 404,
				error: { message: `Provided command does not exist` }
			};
		}

		const info = {
			prefix: sb.Command.prefix,
			aliases: commandData.Aliases,
			cooldown: commandData.Cooldown,
			description: commandData.Description,
			dynamicDescription: null as null | readonly string[],
			flags: commandData.Flags,
			name: commandData.Name,
			params: commandData.Params
		};

		const includeDynamicDescription = url.searchParams.has("includeDynamicDescription");
		if (includeDynamicDescription) {
			try {
				info.dynamicDescription = await commandData.getDynamicDescription();
			}
			catch (e) {
				if (!(e instanceof Error)) {
					throw e;
				}

				return {
					statusCode: 500,
					error: {
						reason: "Command dynamic description function failed",
						message: String(e.message)
					}
				};
			}
		}

		return {
			statusCode: 200,
			data: { info }
		};
	},

	list: () => {
		const data = [];
		for (const command of sb.Command.data.values()) {
			data.push({
				name: command.Name,
				aliases: command.Aliases,
				description: command.Description,
				cooldown: command.Cooldown,
				flags: command.Flags
			});
		}

		return {
			statusCode: 200,
			data
		};
	},

	summary: async (req, res, url) => {
		const commandName = url.searchParams.get("command");
		if (!commandName) {
			return {
				statusCode: 400,
				error: { message: `Command name must be provided` }
			};
		}

		const commandData = sb.Command.get(commandName);
		if (!commandData) {
			return {
				statusCode: 404,
				error: { message: `Provided command does not exist` }
			};
		}

		const info = [
			`$${commandData.Name}`
		];

		if (commandData.Aliases.length > 0) {
			const aliases = commandData.Aliases.map(i => `$${i}`).join(", ");
			info.push(`Aliases\n${aliases}`);
		}

		info.push(`Quick description\n${commandData.Description}`);

		if (commandData.Params.length > 0) {
			const params = commandData.Params.map(i => `${i.name} (${i.type})`).join("\n");
			info.push(`Parameters\n${params}`);
		}

		try {
			const dynamicDescription = await commandData.getDynamicDescription();
			if (dynamicDescription) {
				info.push(`Full description\n${dynamicDescription.join("\n")}`);
			}
		}
		catch (e) {
			return {
				statusCode: 500,
				error: {
					reason: "Command dynamic description function failed",
					message: (e instanceof Error) ? e.message : String(e)
				}
			};
		}

		return {
			statusCode: 200,
			data: {
				summary: info.join("\n\n")
			}
		};
	}
} satisfies ApiDefinition;
