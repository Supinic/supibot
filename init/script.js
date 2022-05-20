const initializeDatabase = require("supi-db-init");
const path = require("path");

require("../db-access.js");

const config = {
	auth: {
		user: process.env.MARIA_USER,
		host: process.env.MARIA_HOST,
		password: process.env.MARIA_PASSWORD
	},
	definitionFilePaths: [],
	sharedDefinitionNames: [
		"chat_data/database",
		"chat_data/tables/Error",
		"chat_data/tables/Platform",
		"chat_data/tables/Channel",
		"chat_data/tables/Chat_Module",
		"chat_data/tables/Channel_Chat_Module",
		"chat_data/tables/User_Alias",
		"chat_data/tables/Custom_Data_Property",
		"chat_data/tables/Channel_Data",
		"chat_data/tables/User_Alias_Data",
		"chat_data/tables/Command",
		"chat_data/tables/Command_Execution",
		"chat_data/tables/AFK",
		"chat_data/tables/Banphrase",
		"chat_data/tables/Log",
		"chat_data/tables/Filter",
		"chat_data/tables/Message_Meta_Channel",
		"chat_data/tables/Message_Meta_User_Alias",
		"chat_data/tables/Reminder",

		"data/database",
		"data/tables/Config"
	],
	initialDataFiles: [
		"chat_data/Platform",
		"data/Config"
	],
	sharedInitialDataNames: [
		"chat_data/Custom_Data_Property"
	],
	meta: {
		dataPath: path.join(__dirname, "initial-data"),
		// definitionPath: path.join(__dirname, "definitions"), // unused currently
		requiredMariaMajorVersion: 10
	}
};

initializeDatabase(config)
	.then(() => {
		console.log("OK");
		process.exit();
	})
	.catch(e => {
		console.error(e);
		process.exit();
	});
