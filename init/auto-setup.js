(async () => {
	const updateRow = (async function (db, table, pk, key, value) {
		const row = await sb.Query.getRow(db, table);
		await row.load(pk);

		row.values[key] = value;
		await row.save();
	});

	console.log("Setting up package manager...");
	const allowedManagers = ["npm", "yarn"];
	const packageManager = process.env.DEFAULT_PACKAGEMANAGER;
	if (!packageManager || !allowedManagers.includes(packageManager)) {
		console.error("Invalid or no package manager specified in env.DEFAULT_PACKAGEMANAGER");
		process.exit(1);
	}

	console.log("Setting up initial database state...");
	try {
		const util = require("util");
		const { exec } = require("child_process");
		const shell = util.promisify(exec);

		await shell(`${packageManager} run init-database`);
	}
	catch (e) {
		console.error("Database structure setup failed, aborting...", e.message);
		process.exit(1);
	}

	console.log("Setting up query builder...");
	try {
		await require("supi-core")("sb", {
			whitelist: [
				"objects/date",
				"objects/error",
				"singletons/query"
			]
		});
	}
	catch (e) {
		console.error("Query builder load failed, aborting...", e.message);
		process.exit(1);
	}

	const platformsData = {
		twitch: {
			ID: 1,
			envs: ["TWITCH_OAUTH", "TWITCH_CLIENT_ID"]
		},
		discord: {
			ID: 2,
			envs: ["DISCORD_BOT_TOKEN"]
		},
		cytube: {
			ID: 3,
			envs: ["CYTUBE_BOT_PASSWORD"]
		}
	};
	const platforms = Object.keys(platformsData);

	console.log("Setting up initial platform...");
	const initialPlatform = process.env.INITIAL_PLATFORM;
	if (!initialPlatform || !platforms.includes(initialPlatform)) {
		console.error("Invalid or no initial platform specified in env.INITIAL_PLATFORM");
		process.exit(1);
	}

	const platformData = platformsData[initialPlatform];
	for (const envKey of platformData.envs) {
		const env = process.env[envKey];
		if (!env) {
			console.error(`Missing env.${envKey} for platform ${initialPlatform}`);
			process.exit(1);
		}

		await updateRow("data", "Config", envKey, "Value", env);
	}

	console.log("Setting up initial bot name for platform...");
	const botName = process.env.INITIAL_BOT_NAME;
	if (!botName) {
		console.error("No initial bot name specified in env.INITIAL_BOT_NAME");
		process.exit(1);
	}
	else {
		await updateRow("chat_data", "Platform", platformData.ID, "Self_Name", botName);
	}

	console.log("Setting up initial bot name for platform...");
	const channelName = process.env.INITIAL_CHANNEL;
	if (!channelName) {
		console.error("No initial channel name specified in env.INITIAL_CHANNEL");
		process.exit(1);
	}
	else {
		const channelRow = await sb.Query.getRow("chat_data", "Channel");
		const exists = await sb.Query.getRecordset(rs => rs
			.select("1")
			.from("chat_data", "Channel")
			.where("Name = %s", channelName)
			.where("Platform = %n", platformData.ID)
			.flat("1")
			.single()
		);

		if (exists) {
			console.log("Initial channel exists, skipping...");
		}
		else {
			channelRow.setValues({
				Name: channelName,
				Platform: platformData.ID
			});

			await channelRow.save({ ignore: true });
		}
	}

	const commandPrefix = process.env.COMMAND_PREFIX;
	if (!commandPrefix) {
		console.error("No command prefix specified in env.COMMAND_PREFIX");
		process.exit(1);
	}

	console.log("All done! Automatic setup will now exit.");
	process.exit();
})();
