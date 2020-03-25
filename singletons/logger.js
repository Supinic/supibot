/* global sb */
module.exports = (function (Module) {
	"use strict";
	const CronJob = require("cron").CronJob;

	/**
	 * Logging module that handles all possible chat message and video logging.
	 * Accesses the database so that nothing needs to be exposed in chat clients.
	 * @name sb.Logger
	 * @type Logger()
	 */
	return class Logger extends Module {
		static async singleton () {
			if (!Logger.module) {
				Logger.module = await new Logger();
			}
			return Logger.module;
		}

		constructor () {
			super();

			this.videoTypes = [];
			this.channels = [];
			this.meta = {};
			this.batches = {};

			this.messageCron = new CronJob(sb.Config.get("CRON_MESSAGE_CONFIG"), async () => {
				if (!sb.Config.get("MESSAGE_LOGGING_ENABLED")) {
					return;
				}

				const msgs = Object.values(this.batches).reduce((acc, cur) => acc += cur.records.length, 0);
				const start = sb.Date.now();

				if (sb.Master && sb.Master.data.realtimeMarkov) {
					const messages = Object.values(Logger.batches).map(i => i.records.map(j => j.Text)).flat();
					await sb.Master.data.realtimeMarkov.process(messages.join(" "));
				}

				await Promise.all(Object.values(this.batches).map(batch => batch.insert()));

				const delta = sb.Date.now() - start;
				if (delta > 1000) {
					// If the addition took more than 1 second, log it as a warning - might be dangerous.
					console.warn("message cron: " + msgs + " messages; " + delta + " ms");
				}
			});
			this.messageCron.start();

			this.metaCron = new CronJob(sb.Config.get("CRON_META_MESSAGE_CONFIG"), async () => {
				if (!sb.Config.get("MESSAGE_LOGGING_ENABLED") || !sb.Config.get("MESSAGE_META_LOGGING_ENABLED") || !this.metaBatch.ready) {
					return;
				}

				const now = new sb.Date().discardTimeUnits("s", "ms");
				for (const [channelID, {amount, length, users}] of Object.entries(this.meta)) {
					if (amount === 0 && length === 0) {
						continue;
					}

					for (const [userID, {amount, length}] of Object.entries(users)) {
						this.countMetaBatch.add({
							Timestamp: now,
							Channel: channelID,
							User_Alias: userID,
							Amount: amount,
							Length: length
						});
					}

					this.metaBatch.add({
						Timestamp: now,
						Channel: channelID,
						Amount: amount,
						Length: length
					});

					this.meta[channelID] = { amount: 0, length: 0, users: {} };
				}

				try {
					await Promise.all([
						this.metaBatch.insert(),
						this.countMetaBatch.insert()
					]);
				}
				catch (e) {
					if (e.code === "ER_DUP_ENTRY") {
						await sb.SystemLogger.sendError("Database", e, null);
					}
					else {
						throw e;
					}
				}
			});
			this.metaCron.start();

			this.banCollector = new Map();
			this.banCron = new CronJob(sb.Config.get("CRON_META_MESSAGE_CONFIG"), async () => {
				if (!this.banBatch.ready) {
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
			});
			this.banCron.start();

			this.commandCollector = new Set();
			this.commandCron = new CronJob(sb.Config.get("COMMAND_LOG_CRON_CONFIG"), async () => {
				if (!sb.Config.get("COMMAND_LOGGING_ENABLED") || !this.commandBatch.ready) {
					return;
				}

				await this.commandBatch.insert();

				this.commandCollector.clear();
			});
			this.commandCron.start();

			return (async () => {
				this.metaBatch = await sb.Query.getBatch(
					"chat_data",
					"Message_Meta_Channel",
					["Timestamp", "Channel", "Amount", "Length"]
				);

				this.countMetaBatch = await sb.Query.getBatch(
					"chat_data",
					"Message_Meta_Count",
					["Timestamp", "Channel", "Amount", "Length", "User_Alias"]
				);

				this.banBatch = await sb.Query.getBatch(
					"chat_data",
					"Twitch_Ban",
					["User_Alias", "Channel", "Length", "Issued"]
				);

				this.commandBatch = await sb.Query.getBatch(
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
				);

				this.videoTypes = await sb.Query.getRecordset(rs => rs
					.select("ID", "Type")
					.from("data", "Video_Type")
				);

				return this;
			})();
		}

		/**
		 * Pushes a message to a specified channel's queue.
		 * Queues are emptied accordingly to cronjobs prepared in {@link Logger.constructor}
		 * @param {string} message
		 * @param {User} userData
		 * @param {Channel} channelData
		 * @returns {Promise<void>}
		 */
		async push (message, userData, channelData) {
			if (!sb.Config.get("MESSAGE_LOGGING_ENABLED")) {
				return;
			}

			const chan = channelData.ID;
			if (!this.channels.includes(chan)) {
				const name = channelData.getDatabaseName();

				this.batches[chan] = await sb.Query.getBatch("chat_line", name, ["User_Alias", "Text", "Posted"]);
				this.meta[chan] = { amount: 0, length: 0, users: {} };
				this.channels.push(chan);
			}

			if (sb.Master && sb.Master.ACTIVITY_LOG === true) {
				console.log("[" + channelData.Name + "] <" + userData.Name + "> " + message);
			}

			this.batches[chan].add({
				User_Alias: userData.ID,
				Text: message,
				Posted: new sb.Date()
			});

			if (!this.meta[chan].users[userData.ID]) {
				this.meta[chan].users[userData.ID] = { amount: 0, length: 0 };
			}

			this.meta[chan].users[userData.ID].amount += 1;
			this.meta[chan].users[userData.ID].length += message.length;

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
			if (!sb.Config.get("CYTUBE_VIDEO_LOGGING_ENABLED")) {
				return;
			}

			if (this.videoTypes.length === 0) {
				return;
			}

			const type = this.videoTypes.find(i => i.Type === typeIdentifier);
			if (!type) {
				sb.SystemLogger.send("Cytube.Fail", "Unsupported video type", type);
				return;
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
			if (!sb.Config.get("TWITCH_BAN_LOGGING_ENABLED")) {
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
		 *
		 * @param options
		 */
		logCommandExecution (options) {
			if (!sb.Config.get("COMMAND_LOGGING_ENABLED")) {
				return;
			}

			if (this.commandCollector.has(options.Executed.valueOf())) {
				return;
			}

			this.commandCollector.add(options.Executed.valueOf());
			this.commandBatch.add(options);
		}

		get modulePath () { return "logger"; }

		/**
		 * Cleans up and destroys the logger instance
		 */
		destroy () {
			this.messageCron.stop();
			this.metaCron.stop();

			for (const chan of this.channels) {
				this.batches[chan].destroy();
				this.meta[chan] = null;
			}

			this.metaBatch.destroy();
			this.metaBatch = null;
			this.batches = null;
			this.meta = null;
		}
	};
});