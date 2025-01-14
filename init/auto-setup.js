/* eslint-disable unicorn/no-process-exit */
(async () => {
	console.log("Setting up query builder...");
	try {
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
		console.error("Query builder load failed, aborting...", e.message);
		process.exit(1);
	}

	const platformsData = {
		twitch: {
			ID: 1,
			envs: []
		},
		discord: {
			ID: 2,
			envs: []
		},
		cytube: {
			ID: 3,
			envs: []
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
	}

	if (initialPlatform === "twitch") {
		console.log("Setting up initial channel for platform Twitch...");
		const channelName = process.env.INITIAL_TWITCH_CHANNEL;
		if (!channelName) {
			const channels = await sb.Query.getRecordset(rs => rs
				.select("COUNT(*) AS Count")
				.from("chat_data", "Channel")
				.where("Platform = %n", platformData.ID)
				.flat("Count")
				.single()
			);

			if (channels.length === 0) {
				console.error("No env.INITIAL_TWITCH_CHANNEL set up during first run");
				process.exit(1);
			}
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
				console.log("Initial twitch channel already exists, skipping...");
			}
			else {
				channelRow.setValues({
					Name: channelName,
					Platform: platformData.ID
				});

				await channelRow.save({ ignore: true });
			}
		}
	}

	console.log("All done! Automatic setup will now exit.");
	process.exit();
})();
