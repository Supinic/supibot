const { CronJob } = require("cron");

const notified = {
	lastSeen: false,
	privatePlatformLogging: []
};

/**
 * @param {Object} obj
 * @param {User} userData
 * @param {Platform} platformData
 */
const fillObjectByPlatform = (obj, userData, platformData) => {
	if (platformData.Name === "twitch") {
		obj.Platform_ID = userData.Twitch_ID ?? userData.Name;
		obj.Historic = !(userData.Twitch_ID); // `false` if user has a Twitch ID, true otherwise
	}
	else if (platformData.Name === "discord") {
		obj.Platform_ID = userData.Discord_ID ?? userData.Name;
		obj.Historic = !(userData.Discord_ID); // `false` if user has a Discord ID, true otherwise
	}
	else if (platformData.Name === "cytube") {
		obj.Platform_ID = userData.Name;
		obj.Historic = false; // Always false, names are unique on Cytube
	}
	else {
		obj.Platform_ID = userData.Name;
		obj.Historic = true; // Always true, undefined ID behaviour on other, unspecified platforms
	}
};

/**
 * Logging module that handles all possible chat message and video logging.
 * Accesses the database so that nothing needs to be exposed in chat clients.
 */
module.exports = class LoggerSingleton {
	#crons = [];
	#presentTables = null;
	#lastSeenUserMap = new Map();

	constructor () {
		this.videoTypes = null;

		if (sb.Config.get("LOG_MESSAGE_CRON", false)) {
			this.channels = [];
			this.platforms = [];
			this.batches = {};
			this.loggingWarnLimit = sb.Config.get("LOGGING_WARN_LIMIT", false) ?? 2500;

			sb.Query.getRecordset(rs => rs
				.select("TABLE_NAME")
				.from("INFORMATION_SCHEMA", "TABLES")
				.where("TABLE_SCHEMA = %s", "chat_line")
				.flat("TABLE_NAME")
			).then(data => (this.#presentTables = data));

			this.messageCron = new CronJob(sb.Config.get("LOG_MESSAGE_CRON"), async () => {
				const keys = Object.keys(this.batches);
				for (let i = 0; i < keys.length; i++) {
					const key = keys[i];
					if (this.batches[key].records?.length > 0) {
						if (this.batches[key].records.length > this.loggingWarnLimit) {
							const length = this.batches[key].records.length;
							const channelID = Number(key.split("-")[1]);
							const channelData = sb.Channel.get(channelID);

							await sb.Logger.log(
								"Message.Warning",
								`Channel "${channelData.Name}" exceeded logging limit ${length}/${this.loggingWarnLimit}`,
								channelData,
								null
							);

							this.batches[key].clear();
							continue;
						}

						setTimeout(
							() => this.batches[key]?.insert(),
							i * 250
						);
					}
				}
			});

			this.messageCron.start();
			this.#crons.push(this.messageCron);
		}

		if (sb.Config.get("LOG_COMMAND_CRON", false)) {
			sb.Query.getBatch(
				"chat_data",
				"Command_Execution",
				[
					"User_Alias",
					"Command",
					"Platform",
					"Executed",
					"Channel",
					"Success",
					"Invocation",
					"Arguments",
					"Result",
					"Execution_Time"
				]
			).then(batch => (this.commandBatch = batch));

			this.commandCollector = new Set();
			this.commandCron = new CronJob(sb.Config.get("LOG_COMMAND_CRON"), async () => {
				if (!sb.Config.get("LOG_COMMAND_ENABLED") || !this.commandBatch?.ready) {
					return;
				}

				await this.commandBatch.insert({ ignore: true });

				this.commandCollector.clear();
			});

			this.commandCron.start();
			this.#crons.push(this.commandCron);
		}

		if (sb.Config.get("LOG_LAST_SEEN_CRON", false)) {
			this.lastSeen = new Map();
			this.lastSeenRunning = false;

			this.lastSeenCron = new CronJob(sb.Config.get("LOG_LAST_SEEN_CRON"), async () => {
				if (!sb.Config.get("LOG_LAST_SEEN_ENABLED", false) || this.lastSeenRunning) {
					return;
				}

				this.lastSeenRunning = true;

				const data = [];
				for (const [channelID, userMap] of this.lastSeen) {
					for (const [userID, { count, date, message }] of userMap) {
						data.push({
							count,
							channel: channelID,
							date,
							message,
							user: userID
						});
					}

					userMap.clear();
				}

				if (data.length === 0) {
					this.lastSeenRunning = false;
					return;
				}

				try {
					await sb.Query.pool.batch(
						sb.Utils.tag.trim `
							INSERT INTO chat_data.Message_Meta_User_Alias
							(User_Alias, Channel, Message_Count, Last_Message_Posted, Last_Message_Text)
							VALUES (?, ?, ?, ?, ?)
							ON DUPLICATE KEY UPDATE
							Message_Count = Message_Count + VALUES(Message_Count),
							Last_Message_Posted = VALUES(Last_Message_Posted),
							Last_Message_Text = VALUES(Last_Message_Text)
						`,
						data.map(i => [
							i.user,
							i.channel,
							i.count,
							i.date,
							i.message
						])
					);
				}
				finally {
					this.lastSeenRunning = false;
				}
			});

			this.lastSeenCron.start();
			this.#crons.push(this.lastSeenCron);
		}
	}

	/**
	 * Inserts a log message into the database - `chat_data.Log` table
	 * @param {string} tag
	 * @param {string} [description] = null
	 * @param {{ ID: number }} [channel] = null
	 * @param {{ ID: number }} [user] = null
	 * @returns {Promise<number>} ID of the created database logging record
	 */
	async log (tag, description = null, channel = null, user = null) {
		const [parentTag, childTag = null] = tag.split(".");
		const row = await sb.Query.getRow("chat_data", "Log");

		row.setValues({
			Tag: parentTag,
			Subtag: childTag,
			Description: (typeof description === "string")
				? description.slice(0, 65000)
				: description,
			Channel: (channel) ? channel.ID : null,
			User_Alias: (user) ? user.ID : null
		});

		const { insertId } = await row.save();
		return insertId;
	}

	/**
	 * Logs a new error, and returns its ID.
	 * @param {string} type
	 * @param {sb.Error|Error} error
	 * @param {Object} [data]
	 * @param {"Internal"|"External"} [data.origin] Whether the error is first- or third-party
	 * @param {Object} [data.context] Object with any additional info
	 * @param {Array} [data.arguments] Possible command arguments that led to the error
	 * @returns {Promise<number>} ID of the created database error record
	 */
	async logError (type, error, data = {}) {
		if (!sb.Config.get("LOG_ERROR_ENABLED", false)) {
			return;
		}

		const message = error.message ?? null;
		if (message && message.includes("retrieve connection from pool timeout")) {
			return;
		}

		const row = await sb.Query.getRow("chat_data", "Error");
		row.setValues({
			Type: type,
			Origin: data.origin ?? null,
			Message: error.message ?? null,
			Stack: error.stack ?? null,
			Context: (data.context) ? JSON.stringify(data.context) : null,
			Arguments: (data.arguments) ? JSON.stringify(data.arguments) : null
		});

		const { insertId } = await row.save();
		return insertId;
	}

	/**
	 * Pushes a message to a specified channel's queue.
	 * Queues are emptied accordingly to cron-jobs prepared in {@link LoggerSingleton.constructor}
	 * @param {string} message
	 * @param {User} userData
	 * @param {Channel} channelData
	 * @param {Platform} [platformData]
	 * @returns {Promise<void>}
	 */
	async push (message, userData, channelData, platformData) {
		if (!this.#presentTables === null) {
			return;
		}

		if (channelData) {
			if (!channelData.Logging.has("Lines")) {
				if (channelData.Logging.has("Meta")) {
					await this.updateLastSeen({
						channelData,
						message,
						userData
					});
				}

				return;
			}

			const chan = `channel-${channelData.ID}`;
			if (!this.channels.includes(chan)) {
				const name = channelData.getDatabaseName();
				const columns = ["Text", "Posted"];

				if (!this.#presentTables.includes(name)) {
					const exists = await sb.Query.isTablePresent("chat_line", name);
					if (!exists) {
						await channelData.setup();
					}
				}

				const [hasUserAlias, hasPlatformID] = await Promise.all([
					sb.Query.isTableColumnPresent("chat_line", name, "User_Alias"),
					sb.Query.isTableColumnPresent("chat_line", name, "Platform_ID")
				]);

				if (hasUserAlias) {
					columns.push("User_Alias");
				}
				if (hasPlatformID) {
					columns.push("Platform_ID", "Historic");
				}

				this.batches[chan] = await sb.Query.getBatch("chat_line", name, columns);
				this.channels.push(chan);
			}

			const lineObject = {
				Text: message,
				Posted: new sb.Date()
			};

			const batch = this.batches[chan];
			const hasUserAlias = batch.columns.some(i => i.name === "User_Alias");
			const hasPlatformID = batch.columns.some(i => i.name === "Platform_ID");

			if (hasUserAlias) {
				lineObject.User_Alias = userData.ID;
			}
			if (hasPlatformID) {
				fillObjectByPlatform(lineObject, userData, channelData.Platform);
			}

			try {
				batch.add(lineObject);
			}
			catch (e) {
				await sb.Logger.log(
					"System.Warning",
					"Incorrect Batch definition",
					channelData
				);

				const index = this.channels.indexOf(chan);
				this.channels.splice(index, 1);

				batch.clear();
				batch.destroy();
				delete this.batches[chan];
			}
		}
		else if (platformData) {
			const id = `platform-${platformData.ID}`;

			if (!this.platforms.includes(id)) {
				const name = platformData.privateMessageLoggingTableName;
				if (!this.#presentTables.includes(name)) {
					if (!notified.privatePlatformLogging.includes(this.Name)) {
						console.warn(`Cannot log private messages on platform ${this.Name} - logging table (chat_line.${name}) does not exist`);
						notified.privatePlatformLogging.push(this.Name);
					}

					return;
				}

				this.batches[id] = await sb.Query.getBatch("chat_line", name, ["Text", "Posted", "Platform_ID", "Historic"]);
				this.platforms.push(id);
			}

			const lineObject = {
				Text: message,
				Posted: new sb.Date()
			};

			const batch = this.batches[id];
			fillObjectByPlatform(lineObject, userData, platformData);

			batch.add(lineObject);
		}
	}

	/**
	 * Saves a video link to database. Used in Cytube-like channels to log video requests
	 * @param {string} link
	 * @param {string} typeIdentifier
	 * @param {number} length
	 * @param {{ ID: number }} userData
	 * @param {{ ID: number }} channelData
	 * @returns {Promise<void>}
	 */
	async logVideoRequest (link, typeIdentifier, length, userData, channelData) {
		if (!this.videoTypes) {
			this.videoTypes = await sb.Query.getRecordset(rs => rs
				.select("ID", "Type")
				.from("data", "Video_Type")
			);
		}
		else if (this.videoTypes.length === 0) {
			return;
		}

		const type = this.videoTypes.find(i => i.Type === typeIdentifier);
		if (!type) {
			throw new sb.Error({
				message: "Video type not found",
				args: {
					input: type,
					supported: this.videoTypes
				}
			});
		}

		const row = await sb.Query.getRow("cytube", "Video_Request");
		row.setValues({
			User_Alias: userData.ID,
			Posted: new sb.Date(),
			Link: link,
			Type: type.ID,
			Length: length,
			Channel: channelData.ID
		});

		await row.save();
	}

	/**
	 * Inserts a Twitch-specific ban data to the database.
	 * @param {string|number} identifier
	 * @param {sb.Channel} channelData
	 * @param {number} length
	 * @param {sb.Date} date
	 * @param {string|null} notes
	 */
	logBan (identifier, channelData, length, date, notes) {
		if (!(this.banCollector instanceof Map)) {
			return;
		}

		this.banCollector.set(identifier, {
			Channel: channelData.ID,
			Length: length || null,
			Issued: date,
			Notes: notes || null
		});
	}

	/**
	 * Logs a command execution.
	 * @param {Object} options
	 */
	logCommandExecution (options) {
		if (!sb.Config.get("LOG_COMMAND_ENABLED", false)) {
			return;
		}

		if (this.commandCollector.has(options.Executed.valueOf())) {
			return;
		}

		this.commandCollector.add(options.Executed.valueOf());
		this.commandBatch.add(options);
	}

	async updateLastSeen (options) {
		const lastSeenEnabled = sb.Config.get("LOG_LAST_SEEN_ENABLED", false);
		if (lastSeenEnabled === false) {
			if (!notified.lastSeen) {
				console.warn("Requested last-seen update, but it is not enabled", options);
				notified.lastSeen = true;
			}
			return;
		}

		const { channelData, message, userData } = options;
		if (!userData) {
			throw new sb.Error({
				message: "Missing userData for lastSeen data"
			});
		}
		else if (!channelData) {
			throw new sb.Error({
				message: "Missing channelData for lastSeen data"
			});
		}
		else if (!message) {
			throw new sb.Error({
				message: "Missing message for lastSeen data",
				arg: {
					channel: channelData?.ID ?? null,
					user: userData?.ID ?? null,
					messageType: typeof message,
					forcedMessage: String(message)
				}
			});
		}

		if (!this.lastSeen.has(channelData.ID)) {
			this.lastSeen.set(channelData.ID, new Map());
		}

		const count = this.lastSeen.get(channelData.ID).get(userData.ID)?.count ?? 0;
		const now = new sb.Date();

		this.#lastSeenUserMap.set(userData.ID, now.valueOf());
		this.lastSeen.get(channelData.ID).set(userData.ID, {
			message: message.slice(0, 2000),
			count: count + 1,
			date: now
		});
	}

	getUserLastSeen (userID) {
		const result = this.#lastSeenUserMap.get(userID);
		return (result) ? new sb.Date(result) : result;
	}

	/**
	 * Cleans up and destroys the logger instance
	 */
	destroy () {
		for (const cron of this.#crons) {
			cron.stop();
		}
		this.#crons = null;

		if (this.channels) {
			for (const chan of this.channels) {
				this.batches[chan].destroy();
			}
		}

		this.batches = null;
	}

	get modulePath () { return "logger"; }
};
