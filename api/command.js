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
	},

	userFilters: async (req, res, url) => {
		const rawUserID = url.searchParams.get("userID");
		if (!rawUserID) {
			return {
				statusCode: 400,
				error: { message: `Valid user ID must be provided` }
			};
		}

		const userID = Number(rawUserID);
		if (!sb.Utils.isValidInteger(userID)) {
			return {
				statusCode: 400,
				error: { message: `Malformed user ID provided` }
			};
		}

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

		const optout = await sb.Query.getRecordset(rs => rs
			.select("ID")
			.from("chat_data", "Filter")
			.where("Command = %s", commandData.Name)
			.where("User_Alias = %n", userID)
			.where("Type = %s", "Opt-out")
			.where("Active = %b", true)
			.single()
			.flat("ID")
		);

		const blocks = await sb.Query.getRecordset(rs => rs
			.select("Filter.ID AS ID", "Blocked_User.Name AS blockedUsername")
			.from("chat_data", "Filter")
			.join({
				alias: "Blocked_User",
				toTable: "User_Alias",
				on: "Filter.Blocked_User = Blocked_User.ID"
			})
			.where("Command = %s", commandData.Name)
			.where("User_Alias = %n", userID)
			.where("Type = %s", "Block")
			.where("Active = %b", true)
		);

		return {
			statusCode: 200,
			data: {
				optout,
				blocks
			}
		};
	}
};
