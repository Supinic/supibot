(async () => {
	const fs = require("node:fs").promises;
	const util = require("node:util");
	const { exec } = require("node:child_process");
	const readline = require("node:readline");

	const accessFile = "./db-access.js";
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});

	// Prepare readline.question for promisification
	rl.question[util.promisify.custom] = (question) => new Promise((resolve) => rl.question(question, resolve));

	const ask = util.promisify(rl.question);
	const shell = util.promisify(exec);

	const accessConfig = [
		["username", "MARIA_USER", "your_username"],
		["password", "MARIA_PASSWORD", "your_password"],
		["host", "MARIA_HOST", "your_host"],
		["port", "MARIA_PORT", "your_port"],
		["socket", "MARIA_SOCKET_PATH", "your_socket"]
	];

	console.log("Checking for database access file...");
	try {
		await fs.access(accessFile);
		console.log("Database access file exists, no need to copy the example.");
	}
	catch {
		console.log("Database access file does not exist - attempting to copy example access file...");
		try {
			await fs.copyFile("./db-access.js.example", accessFile);
			console.log("Example file copied successfully.");
		}
		catch (e) {
			console.error("Copying example file failed, aborting...", e);
			process.exit(1);
		}
	}

	let accessFileString = (await fs.readFile(accessFile)).toString();
	for (const [name, config, implicit] of accessConfig) {
		if (!accessFileString.includes(config)) {
			console.log(`The variable for database ${name} is gone (${config}) - skipping...`);
		}
		else if (!accessFileString.includes(implicit)) {
			console.log(`Database ${name} is already set up - skipping...`);
		}
		else {
			const result = await ask(`Set up database ${name} - type a new value (or nothing to ${name === "port" ? "use 3306" : "keep empty"})\n`);

			if (!result) {
				const value = name === "port"
					? "3306"
					: "";
				accessFileString = accessFileString.replace(implicit, value);
				await fs.writeFile(accessFile, accessFileString);
				console.log(`Variable for ${name} is now empty.`);
			}
			else {
				accessFileString = accessFileString.replace(implicit, result);
				await fs.writeFile(accessFile, accessFileString);
				console.log(`Variable for ${name} is now set up.`);
			}
		}
	}
	console.log("Database credentials setup successfully.");

	console.log("Setting up database structure...");
	try {
		await shell(`yarn run init-database`);
	}
	catch (e) {
		console.error("Database structure setup failed, aborting...", e);
		process.exit(1);
	}
	console.log("Structure set up successfully.");

	console.log("Loading database credentials & query builder...");
	try {
		eval(accessFileString);

		const core = await import("supi-core");
		const Query = new core.Query({
			user: process.env.MARIA_USER,
			password: process.env.MARIA_PASSWORD,
			host: process.env.MARIA_HOST,
			connectionLimit: process.env.MARIA_CONNECTION_LIMIT
		});

		globalThis.sb = {
			Date: core.Date,
			Error: core.Error,
			Query
		};
	}
	catch (e) {
		console.error("Credentials/query builder load failed, aborting...", e);
		process.exit(1);
	}
	console.log("Query prepared.");

	console.log("Setting up platform access...");
	const platformList = {
		twitch: { auth: "TWITCH_OAUTH", extra: "TWITCH_CLIENT_ID", extraName: "Client ID", ID: 1 },
		discord: { auth: "DISCORD_BOT_TOKEN", ID: 2 },
		cytube: { auth: "CYTUBE_BOT_PASSWORD", ID: 3 }
	};

	const prettyList = `${Object.keys(platformList).join(", ")}, or keep line empty to finish`;
	let platform = null;
	let done = false;
	let automatic = false;
	do {
		const initialPlatform = process.env.INITIAL_PLATFORM;
		if (initialPlatform) {
			platform = initialPlatform;
			console.log(`Attempting automatic setup for platform ${platform}`);
			automatic = true;
		}
		else {
			platform = await ask(`Which platform would you like to set up? (${prettyList})\n`);
		}

		platform = platform.toLowerCase();

		if (!platform) {
			console.log("Platform setup finished.");
			done = true;
		}
		else if (!Object.keys(platformList).includes(platform)) {
			console.log("Platform not recognized, try again.");
		}
		else {
			let pass = null;

			if (platform === "twitch") {
				const accessToken = process.env.TWITCH_APP_ACCESS_TOKEN;
				if (accessToken) {
					pass = accessToken;
				}
			}

			if (pass === null) {
				pass = await ask(`Enter authentication key for platform "${platform}":\n`);
			}

			if (!pass) {
				console.log(`Skipped setting up ${platform}!`);
				continue;
			}

			const configRow = await sb.Query.getRow("data", "Config");
			await configRow.load(platformList[platform].auth);
			configRow.values.Value = pass;
			await configRow.save();
			console.log(`Authentication key for ${platform} set up successfully.`);

			if (platformList[platform].extra) {
				let pass = null;
				const extraEnv = process.env[platformList[platform].extra];

				if (extraEnv) {
					pass = extraEnv;
				}
				else {
					pass = await ask(`Enter ${platformList[platform].extraName} for platform "${platform}":\n`);
				}
				if (!pass) {
					console.log(`Skipped setting up ${platform}!`);
					continue;
				}

				const extraRow = await sb.Query.getRow("data", "Config");
				await extraRow.load(platformList[platform].extra);
				extraRow.values.Value = pass;
				await extraRow.save();
			}

			let botName = process.env.INITIAL_BOT_NAME;
			if (!botName) {
				botName = await ask(`Enter bot's account name for platform "${platform}":\n`);

				if (!botName) {
					console.log(`Skipped setting up ${platform}!`);
					continue;
				}
			}

			let done = false;
			do {
				let channelName = null;
				const initialChannel = process.env.INITIAL_CHANNEL;

				if (initialChannel) {
					// Assume the user only wants to join one channel when setting up automatically
					channelName = initialChannel;
					done = true;
				}
				else {
					channelName = await ask(`Enter a channel name the bot should join for platform "${platform}", or leave empty to finish:\n`);
				}

				if (!channelName) {
					console.log(`Finished setting up ${platform}.`);
					done = true;
					continue;
				}

				const channelRow = await sb.Query.getRow("chat_data", "Channel");
				channelRow.setValues({
					Name: channelName,
					Platform: platformList[platform].ID
				});

				await channelRow.save({
					ignore: true,
					skipLoad: true
				});

				console.log(`Bot will now join ${platform} in channel ${channelName}.`);
			} while (!done);
		}
		// Assume the user only wants to set up one platform when setting up automatically
		if (automatic) {
			done = true;
		}
	} while (!done);

	const adminUsername = await ask("Select an administrator username, or just send empty input to skip:");
	if (adminUsername) {
		const userRow = await sb.Query.getRow("chat_data", "User_Alias");
		await userRow.load(adminUsername, true);
		if (!userRow.loaded) {
			userRow.values.Name = adminUsername;
			await userRow.save({ skipLoad: false });

			console.log("Successfully set up administrator user object");
		}

		const filteredCommands = ["ban", "debug", "reload"];
		for (const command of filteredCommands) {
			const filterExists = await sb.Query.getRecordset(rs => rs
				.select("ID")
				.from("chat_data", "Filter")
				.where("User_Alias = %n", userRow.values.ID)
				.where("Command = %s", command)
				.where("Type = %s", "Whitelist")
				.where("Active = %b", true)
				.single()
				.flat("ID")
			);

			if (!filterExists) {
				const filterRow = await sb.Query.getRow("chat_data", "Filter");
				filterRow.setValues({
					User_Alias: userRow.values.ID,
					Command: command,
					Type: "Whitelist",
					Issued_By: userRow.values.ID,
					Active: true
				});

				await filterRow.save({
					ignore: true,
					skipLoad: true
				});

				console.log(`Enabled the use of the "${command}" command for administrator`);
			}
		}

		const userDataRow = await sb.Query.getRow("chat_data", "User_Alias_Data");
		userDataRow.setValues({
			Property: "administrator",
			Value: "true"
		});

		await userDataRow.save({ ignore: true, skipLoad: true });
		console.log(`Set up the "administrator" flag to "true"`);
	}

	const internalAPIPort = process.env.SUPIBOT_API_PORT;
	if (!internalAPIPort) {
		let port;
		let skipped = false;

		do {
			port = await ask("Select a port for the bot internal API. This is not required and can be skipped - a random port will be generated then.");
			skipped = Boolean(port);
			port = Number(port);
		} while (!skipped || !Number.isFinite(port) || port < 0 || port > 65535 || Math.trunc(port) !== port);

		if (skipped) {
			port = Math.trunc(Math.random() * 50000) + 10000;
		}

		const configRow = await sb.Query.getRow("data", "Config");
		await configRow.load("SUPIBOT_API_PORT");
		configRow.values.Value = port;
		await configRow.save();

		if (skipped) {
			console.log(`Internal bot API port automatically set to ${port}`);
		}
		else {
			console.log(`Internal bot API port set to ${port}`);
		}
	}

	console.log("All done! Setup will now exit.");
	process.exit();
})();
