import initializeDatabase from "supi-db-init";
import path from "node:path";

const config = {
	auth: {
		user: process.env.MARIA_USER,
		host: process.env.MARIA_HOST,
		password: process.env.MARIA_PASSWORD
	},
	definitionFilePaths: [
		"chat_data/tables/Error",
		"chat_data/tables/Channel",
		"chat_data/tables/Chat_Module",
		"chat_data/tables/Channel_Chat_Module",
		"chat_data/tables/User_Alias",
		"chat_data/tables/Channel_Data",
		"chat_data/tables/User_Alias_Data",
		"chat_data/tables/Command_Execution",
		"chat_data/tables/Meta_Channel_Command",
		"chat_data/tables/AFK",
		"chat_data/tables/Banphrase",
		"chat_data/tables/Log",
		"chat_data/tables/Filter",
		"chat_data/tables/Message_Meta_User_Alias",
		"chat_data/tables/Reminder",
		"chat_data/tables/Reminder_History",
		"chat_data/triggers/add_missing_first_channel_command_after_insert",
		"chat_data/triggers/add_missing_first_message_data_after_insert"
	],
	initialDataFilePaths: [
		"chat_data/Custom_Data_Property"
	],
	meta: {
		dataPath: path.join(import.meta.dirname, "initial-data"),
		definitionPath: path.join(import.meta.dirname, "definitions"),
		requiredMariaMajorVersion: 10
	}
};

await initializeDatabase(config);
