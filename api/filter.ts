import type Filter from "../classes/filter.js";
import type { ApiDefinition } from "./index.js";
import type Channel from "../classes/channel.js";
import type User from "../classes/user.js";
import type { JSONifiable } from "../utils/globals.js";

export default {
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

		const [active, inactive] = core.Utils.splitByCondition(IDs, i => Boolean(sb.Filter.get(i)));
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
		const commandName = url.searchParams.get("identifier");
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

		type FilterRecord = {
			ID: Filter["ID"];
			type: Filter["Type"];
			userAlias: Filter["User_Alias"];
			channel: Filter["Channel"];
			invocation: Filter["Invocation"];
			response: Filter["Response"];
			reason: Filter["Reason"];
			data: string | null;
			platform: Filter["Platform"] | null;
			channelName: Channel["Name"] | null;
			channelDescription: Channel["Description"];
			username: User["Name"] | null;
			blockedUsername: User["Name"] | null;
		};

		const data = await core.Query.getRecordset<FilterRecord[]>(rs => rs
			.select(
				"Filter.ID AS ID",
				"Type AS type",
				"User_Alias AS userAlias",
				"Channel AS channel",
				"Invocation AS invocation",
				"Response AS response",
				"Reason AS reason",
				"Filter.Data AS data",
				"Filter.Platform as platform"
			)
			.select("Channel.Name AS channelName", "Channel.Description AS channelDescription")
			.select("User_Alias.Name AS username")
			.select("Blocked.Name AS blockedUsername")
			.from("chat_data", "Filter")
			.leftJoin("chat_data", "Channel")
			.leftJoin("chat_data", "User_Alias")
			.leftJoin({
				alias: "Blocked",
				toTable: "User_Alias",
				on: "Filter.Blocked_User = Blocked.ID"
			})
			.where("Channel IS NULL OR Channel.Mode <> %s", "Inactive")
			.where("Command = %s", commandData.Name)
			.where("Active = %b", true)
		);

		const result = [];
		for (const item of data) {
			let platform = null;
			if (item.platform) {
				const platformData = sb.Platform.get(item.platform);
				if (platformData) {
					platform = platformData.name;
				}
			}

			let data = null;
			if (item.data) {
				data = JSON.parse(item.data) as JSONifiable;
			}

			result.push({ ...item, platform, data });
		}

		return {
			statusCode: 200,
			data: result
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
		if (!core.Utils.isValidInteger(userID)) {
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

		const optout = await core.Query.getRecordset<Filter["ID"] | undefined>(rs => rs
			.select("ID")
			.from("chat_data", "Filter")
			.where("Command = %s", commandData.Name)
			.where("User_Alias = %n", userID)
			.where("Type = %s", "Opt-out")
			.where("Active = %b", true)
			.single()
			.flat("ID")
		) ?? null;

		const blocks = await core.Query.getRecordset<{
			ID: Filter["ID"];
			blockedUsername: User["Name"] | null;
		}>(rs => rs
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
} satisfies ApiDefinition;
