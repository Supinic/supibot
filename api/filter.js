// noinspection JSUnusedGlobalSymbols
module.exports = {
	reloadAll: async () => {
		await sb.Filter.reloadData();
		return {
			statusCode: 200,
			data: { message: "OK" }
		};
	},

	reloadSpecific: async (req, res, url) => {
		const IDs = url.searchParams.getAll("ID").map(Number).filter(Boolean);
		const result = await sb.Filter.reloadSpecific(...IDs);

		const [active, inactive] = sb.Utils.splitByCondition(IDs, i => sb.Filter.get(i));
		return {
			statusCode: 200,
			data: {
				processedIDs: IDs,
				active,
				inactive,
				result
			}
		};
	},

	command: async (req, res, url) => {
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

		const data = await sb.Query.getRecordset(rs => rs
			.select(
				"Filter.ID AS ID",
				"Type AS type",
				"User_Alias AS userAlias",
				"Channel AS channel",
				"Invocation AS invocation",
				"Response AS response",
				"Reason AS reason",
				"Filter.Data AS data"
			)
			.select("Channel.Name AS channelName", "Channel.Description AS channelDescription")
			.select("User_Alias.Name AS username")
			.select("Platform.Name AS platformnName")
			.select("Blocked.Name AS blockedUsername")
			.from("chat_data", "Filter")
			.leftJoin("chat_data", "Channel")
			.leftJoin("chat_data", "User_Alias")
			.leftJoin({
				alias: "Blocked",
				toTable: "User_Alias",
				on: "Filter.Blocked_User = Blocked.ID"
			})
			.leftJoin({
				toTable: "Platform",
				on: "Channel.Platform = Platform.ID"
			})
			.where("Channel IS NULL OR Channel.Mode <> %s", "Inactive")
			.where("Command = %s", commandData.Name)
			.where("Active = %b", true)
		);

		for (const item of data) {
			if (item.data) {
				item.data = JSON.parse(item.data);
			}
		}

		return {
			statusCode: 200,
			data
		};
	},

	userCommand: async (req, res, url) => {
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
