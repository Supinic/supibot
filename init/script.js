(async function () {
	const { readFile } = require("fs/promises");
	try {
		require("../db-access.js");
	}
	catch {
		console.warn("Missing or invalid database access definition!");
		process.exit();
	}

	console.log("Loading utils");
	await require("supi-core")("sb", {
		whitelist: [
			"objects/date",
			"objects/error",
			"singletons/query",
		]
	});
	console.log("Utils loaded");

	const [{ version }] = await sb.Query.raw("SELECT VERSION() AS version");
	const major = Number(version.split(".")[0]);
	console.log("MariaDB version", {version, major});

	if (Number.isNaN(major) || major < 10) {
		throw new Error(`Your version of MariaDB is too old! User at least 10.0 or newer. Your version: ${version}`);
	}

	let counter = 0;
	const definitionFileList = [
		"chat_data/database",
		"chat_data/tables/Cron",
		"chat_data/tables/Error",
		"chat_data/tables/Platform",
		"chat_data/tables/Channel",
		"chat_data/tables/User_Alias",
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
		"chat_data/tables/Twitch_Ban",
		"chat_data/triggers/User_Alias_after_update",

		"data/database",
		"data/tables/Config",
		"data/tables/Got_Instance",
	];

	console.log("=====\nStarting table definition script");
	for (const target of definitionFileList) {
		let content = null;

		try {
			content = await readFile(`${__dirname}/definitions/${target}.sql`);
		}
		catch (e) {
			console.warn(`An error occured while reading ${target}.sql! Skipping...`, e);
			continue;
		}

		let string = null;
		const [database, type, name] = target.split("/");
		if (type === "database") {
			string = `Database ${database}`;
		}
		else if (target.includes("tables")) {
			string = `Table ${database}.${name}`;
		}
		else if (target.includes("triggers")) {
			string = `Trigger ${database}.${name}`;
		}

		let status = null;
		try {
			const operationResult = await sb.Query.raw(content);
			status = operationResult.warningStatus;
		}
		catch (e) {
			console.warn(`An error occured while executing ${target}.sql! Skipping...`, e);
			continue;
		}
		
		if (status === 0) {
			counter++;
			console.log(`${string} created successfully`);
		}
		else {
			console.log(`${string} skipped - already exists`);
		}
	}

	console.log(`=====\nCreate script succeeded.\n${counter} objects created.`);

	const dataFileList = [
		"chat_data/Command",
		"chat_data/Platform",
		"data/Config",
		"data/Got_Instance"
	];

	console.log("=====\nStarting data initialization script");
	counter = 0;
	for (const target of dataFileList) {
		let content = null;
		try {
			content = await readFile(`${__dirname}/initial-data/${target}.sql`);
		}
		catch (e) {
			console.warn(`An error occured while reading ${target}.sql! Skipping...`, e);
			continue;
		}
		
		let status = null;
		try {
			const operationResult = await sb.Query.raw(content);
			status = operationResult.warningStatus;
		}
		catch (e) {
			console.warn(`An error occured while executing ${target}.sql! Skipping...`, e);
			continue;
		}
		
		const [database, table] = target.split("/");
		if (status === 0) {
			counter++;
			console.log(`${database}.${table} initial data inserted successfully`);
		}
		else {
			console.log(`${database}.${table} initial data skipped - error occured`);
		}
	}

	console.log(`=====\nData initialization data script succeeded.\n${counter} tables initialized.`);

	process.exit();
})();