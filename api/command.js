// noinspection JSUnusedGlobalSymbols
module.exports = {
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

		const result = await sb.Command.checkAndExecute(
			invocation,
			args,
			channelData,
			userData,
			{
				platform: platformData,
				skipGlobalBan: url.searchParams.has("skipGlobalBan")
			}
		);

		return {
			statusCode: 200,
			data: {
				result
			}
		};
	},

	info: async (req, res, url) => {
		const commandName = url.searchParams.get("command");
		if (!commandName) {
			return {
				statusCode: 400,
				error: { message: `Valid command name must be provided` }
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
			aliases: commandData.Aliases,
			author: commandData.Author,
			cooldown: commandData.Cooldown,
			description: commandData.Description,
			flags: commandData.Flags,
			name: commandData.Name,
			params: commandData.Params
		};

		try {
			info.dynamicDescription = await commandData.getDynamicDescription();
		}
		catch (e) {
			return {
				statusCode: 500,
				error: {
					reason: "Command dynamic description function failed",
					message: e.message
				}
			};
		}

		return {
			statusCode: 200,
			data: { info }
		};
	}
};
