const notified = {
	lastSeen: false
};

/**
 * Logging module that handles all possible chat message and video logging.
 * Accesses the database so that nothing needs to be exposed in chat clients.
 */
module.exports = class LoggerSingleton extends require("./template.js") {
	#crons = [];
	#presentTables = null;

	/**
	 * @inheritDoc
	 * @returns {LoggerSingleton}
	 */
	static singleton () {
		if (!LoggerSingleton.module) {
			LoggerSingleton.module = new LoggerSingleton();
		}

		return LoggerSingleton.module;
	}

	constructor () {
		super();

		this.videoTypes = null;

		if (sb.Config.get("LOG_MESSAGE_CRON", false)) {
			this.channels = [];
			this.batches = {};
			this.loggingWarnLimit = sb.Config.get("LOGGING_WARN_LIMIT", false) ?? 2500;

			sb.Query.getRecordset(rs => rs
				.select("TABLE_NAME")
				.from("INFORMATION_SCHEMA", "TABLES")
				.where("TABLE_SCHEMA = %s", "chat_line")
				.flat("TABLE_NAME")
			).then(data => (this.#presentTables = data));

			this.messageCron = new sb.Cron({
				Name: "message-cron",
				Expression: sb.Config.get("LOG_MESSAGE_CRON"),
				Code: async () => {
					if (!sb.Config.get("LOG_MESSAGE_ENABLED", false)) {
						return;
					}

					const keys = Object.keys(this.batches);
					for (let i = 0; i < keys.length; i++) {
						const key = keys[i];
						if (this.batches[key].records?.length > 0) {
							if (this.batches[key].records.length > this.loggingWarnLimit) {
								// Think about dropping these messages if limit is exceeded
								console.warn("Logging limit exceeded", {
									key,
									limit: this.loggingWarnLimit,
									messages: this.batches[key].records.length
								});
							}

							setTimeout(
								() => this.batches[key].insert(),
								i * 250
							);
						}
					}
				}
			});

			this.messageCron.start();
			this.#crons.push(this.messageCron);
		}

		if (sb.Config.get("LOG_MESSAGE_META_ENABLED", false)) {
			sb.Query.getBatch(
				"chat_data",
				"Message_Meta_Channel",
				["Timestamp", "Channel", "Amount", "Length"]
			).then(batch => (this.metaBatch = batch));

			sb.Query.getBatch(
				"chat_data",
				"Twitch_Ban",
				["User_Alias", "Channel", "Length", "Issued"]
			).then(batch => (this.banBatch = batch));

			this.meta = {};
			this.metaCron = new sb.Cron({
				Name: "message-meta-cron",
				Expression: sb.Config.get("LOG_MESSAGE_META_CRON"),
				Defer: {
					start: 2500,
					end: 7500
				},
				Code: async () => {
					if (!this.metaBatch?.ready) {
						return;
					}

					const now = new sb.Date().discardTimeUnits("s", "ms");
					for (const [channelID, { amount, length }] of Object.entries(this.meta)) {
						if (amount === 0 && length === 0) {
							continue;
						}

						this.metaBatch.add({
							Timestamp: now,
							Channel: channelID,
							Amount: amount,
							Length: length
						});

						this.meta[channelID] = {
							amount: 0,
							length: 0
						};
					}

					await this.metaBatch.insert({ ignore: true });
				}
			});
			this.metaCron.start();
			this.#crons.push(this.metaCron);

			this.banCollector = new Map();
			this.banCron = new sb.Cron({
				Name: "ban-cron",
				Expression: sb.Config.get("LOG_MESSAGE_META_CRON"),
				Defer: { end: 2500 },
				Code: async () => {
					if (!this.banBatch?.ready) {
						return;
					}

					const bannedUsers = await sb.User.getMultiple([...this.banCollector.keys()]);
					for (const userData of bannedUsers) {
						const linkedUser = this.banCollector.get(userData.Name);
						if (linkedUser) {
							linkedUser.User_Alias = userData.ID;
							this.banBatch.add(linkedUser);
						}
					}

					const channelList = Array.from(this.banCollector.values())
						.map(record => sb.Channel.get(record.Channel))
						.filter((i, ind, arr) => i && arr.indexOf(i) === ind);

					for (const channelData of channelList) {
						channelData.sessionData.recentBans = 0;
					}

					this.banCollector.clear();
					await this.banBatch.insert();
				}
			});
			this.banCron.start();
			this.#crons.push(this.banCron);
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
					"Execution_Time",
					"Command_Name"
				]
			).then(batch => (this.commandBatch = batch));

			this.commandCollector = new Set();
			this.commandCron = new sb.Cron({
				Name: "command-cron",
				Expression: sb.Config.get("LOG_COMMAND_CRON"),
				Code: async () => {
					if (!sb.Config.get("LOG_COMMAND_ENABLED") || !this.commandBatch?.ready) {
						return;
					}

					await this.commandBatch.insert({ ignore: true });

					this.commandCollector.clear();
				}
			});
			this.commandCron.start();
			this.#crons.push(this.commandCron);
		}

		if (sb.Config.get("LOG_LAST_SEEN_CRON", false)) {
			this.lastSeen = new Map();
			this.lastSeenRunning = false;

			this.lastSeenCron = new sb.Cron({
				Name: "last-seen-cron",
				Expression: sb.Config.get("LOG_LAST_SEEN_CRON"),
				Defer: {
					start: 5000,
					end: 60000
				},
				Code: async () => {
					if (!sb.Config.get("LOG_MESSAGE_META_ENABLED", false) || this.lastSeenRunning) {
						return;
					}

					this.lastSeenRunning = true;

					const data = [];
					for (const [channelData, userMap] of this.lastSeen) {
						for (const [userData, { count, date, message }] of userMap) {
							data.push({
								count,
								channel: channelData.ID,
								date,
								message,
								user: userData.ID
							});
						}

						userMap.clear();
					}

					await sb.Query.batchUpdate(data, {
						batchSize: 200,
						staggerDelay: 5000,
						callback: (ru, row) => ru
							.update("chat_data", "Message_Meta_User_Alias")
							.set("Message_Count", {
								useField: true, value: `Message_Count + ${row.count}`
							})
							.set("Last_Message_Posted", row.date)
							.set("Last_Message_Text", row.message)
							.where("User_Alias = %n", row.user)
							.where("Channel = %n", row.channel)
							.priority("low")
							.ignoreDuplicates()
					});
					this.lastSeenRunning = false;
				}
			});
			this.lastSeenCron.start();
			this.#crons.push(this.lastSeenCron);
		}
	}

	/**
	 * Pushes a message to a specified channel's queue.
	 * Queues are emptied accordingly to cronjobs prepared in {@link LoggerSingleton.constructor}
	 * @param {string} message
	 * @param {User} userData
	 * @param {Channel} channelData
	 * @returns {Promise<void>}
	 */
	async push (message, userData, channelData) {
		if (!sb.Config.get("LOG_MESSAGE_ENABLED", false)) {
			return;
		}

		const chan = channelData.ID;
		if (!this.channels.includes(chan)) {
			const name = channelData.getDatabaseName();
			if (this.#presentTables !== null && !this.#presentTables.includes(name)) {
				const exists = await sb.Query.isTablePresent("chat_line", name);
				if (!exists) {
					await channelData.setup();
				}
			}

			this.batches[chan] = await sb.Query.getBatch("chat_line", name, ["User_Alias", "Text", "Posted"]);
			this.meta[chan] = { amount: 0, length: 0 };
			this.channels.push(chan);
		}

		this.batches[chan].add({
			User_Alias: userData.ID,
			Text: message,
			Posted: new sb.Date()
		});

		this.meta[chan].amount += 1;
		this.meta[chan].length += message.length;
	}

	/**
	 * Saves a video link to database. Used in Cytube-like channels to log video requests
	 * @param {string} link
	 * @param {string} typeIdentifier
	 * @param {number} length
	 * @param {User} userData
	 * @param {Channel} channelData
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
	 * @param {Channel} channelData
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
	 * @param options
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
		if (sb.Config.get("LOG_LAST_SEEN_ENABLED", false)) {
			if (!notified.lastSeen) {
				console.warn("Requested last-seen update, but it is not enabled", options);
				notified.lastSeen = true;
			}
			return;
		}

		const { channelData, message, userData } = options;
		if (!userData || !channelData || !message) {
			throw new sb.Error({
				message: "Missing some or all arguments for lastSeen data"
			});
		}

		if (!this.lastSeen.has(channelData)) {
			this.lastSeen.set(channelData, new Map());
		}

		const count = this.lastSeen.get(channelData).get(userData)?.count ?? 0;
		this.lastSeen.get(channelData).set(userData, {
			message,
			count: count + 1,
			date: new sb.Date()
		});
	}

	/**
	 * Cleans up and destroys the logger instance
	 */
	destroy () {
		for (const cron of this.#crons) {
			cron.destroy();
		}
		this.#crons = null;

		this.banBatch?.destroy();
		this.metaBatch?.destroy();
		this.banBatch = null;
		this.metaBatch = null;

		if (this.channels) {
			for (const chan of this.channels) {
				this.batches[chan].destroy();
				this.meta[chan] = null;
			}
		}

		this.batches = null;
		this.meta = null;
	}

	get modulePath () { return "logger"; }
};
