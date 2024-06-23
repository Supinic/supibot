const { CronJob } = require("cron");

const notified = {
	lastSeen: false,
	privatePlatformLogging: []
};

let config;
try {
	config = require("../config.json");
}
catch {
	config = require("../config-default.json");
}

const { logging } = config;
const FALLBACK_WARN_LIMIT = 2500;

/**
 * Logging module that handles all possible chat message and video logging.
 * Accesses the database so that nothing needs to be exposed in chat clients.
 */
module.exports = class LoggerSingleton {
	#crons = [];
	#presentTables = null;
	#lastSeenUserMap = new Map();

	constructor () {
		if (logging.messages.enabled) {
			this.channels = [];
			this.platforms = [];
			this.batches = {};

			const loggingWarnLimit = logging.messages.warnLimit ?? FALLBACK_WARN_LIMIT;

			sb.Query.getRecordset(rs => rs
				.select("TABLE_NAME")
				.from("INFORMATION_SCHEMA", "TABLES")
				.where("TABLE_SCHEMA = %s", "chat_line")
				.flat("TABLE_NAME")
			).then(data => (this.#presentTables = data));

			this.messageCron = new CronJob(logging.messages.cron, async () => {
				const keys = Object.keys(this.batches);
				for (let i = 0; i < keys.length; i++) {
					const key = keys[i];
					if (this.batches[key].records?.length > 0) {
						if (this.batches[key].records.length > loggingWarnLimit) {
							const length = this.batches[key].records.length;
							const channelID = Number(key.split("-")[1]);
							const channelData = sb.Channel.get(channelID);

							await sb.Logger.log(
								"Message.Warning",
								`Channel "${channelData.Name}" exceeded logging limit ${length}/${loggingWarnLimit}`,
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

		if (logging.commands.enabled) {
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
			this.commandCron = new CronJob(logging.commands.cron, async () => {
				if (!this.commandBatch?.ready) {
					return;
				}

				const channels = {};
				for (const record of this.commandBatch.records) {
					if (!record.Channel) {
						continue; // Don't meta-log private message commands
					}

					const existing = channels[record.Channel];
					if (!existing || existing.date < record.Executed) {
						channels[record.Channel] = {
							date: record.Executed,
							command: record.Command,
							result: record.Result
						};
					}
				}

				const metaPromises = Object.entries(channels).map(async (data) => {
					const [channelId, meta] = data;
					const row = await sb.Query.getRow("chat_data", "Meta_Channel_Command");
					await row.load(channelId, true);

					if (!row.loaded) {
						row.values.Channel = channelId;
					}

					row.setValues({
						Last_Command_Executed: meta.command,
						Last_Command_Posted: meta.date,
						Last_Command_Result: meta.result
					});

					await row.save({ skipLoad: true });
				});

				await Promise.all([
					this.commandBatch.insert({ ignore: true }),
					...metaPromises
				]);

				this.commandCollector.clear();
			});

			this.commandCron.start();
			this.#crons.push(this.commandCron);
		}

		if (logging.lastSeen.enabled) {
			this.lastSeen = new Map();
			this.lastSeenRunning = false;

			this.lastSeenCron = new CronJob(logging.lastSeen.cron, async () => {
				if (this.lastSeenRunning) {
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
		if (!logging.errors.enabled) {
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
			const hasUserAlias = batch.columns.some(i => i.name === "User_Alias"); // legacy, should not occur anymore
			const hasPlatformID = batch.columns.some(i => i.name === "Platform_ID");

			if (hasUserAlias) {
				lineObject.User_Alias = userData.ID;
			}
			if (hasPlatformID) {
				try {
					lineObject.Platform_ID = await channelData.Platform.fetchInternalPlatformIDByUsername(userData);
					lineObject.Historic = false;
				}
				catch {
					lineObject.Platform_ID = userData.Name;
					lineObject.Historic = true;
				}
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

			try {
				lineObject.Platform_ID = await platformData.fetchInternalPlatformIDByUsername(userData);
				lineObject.Historic = false;
			}
			catch {
				lineObject.Platform_ID = userData.Name;
				lineObject.Historic = true;
			}

			const batch = this.batches[id];

			batch.add(lineObject);
		}
	}

	/**
	 * Logs a command execution.
	 * @param {Object} options
	 */
	logCommandExecution (options) {
		if (!logging.commands.enabled) {
			return;
		}

		if (this.commandCollector.has(options.Executed.valueOf())) {
			return;
		}

		this.commandCollector.add(options.Executed.valueOf());
		this.commandBatch.add(options);
	}

	async updateLastSeen (options) {
		if (!logging.lastSeen.enabled) {
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
