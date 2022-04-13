/**
 * Represents a pending reminder from (usually) one user to another.
 * An active reminder will be printed into the chat once the target user is spotted.
 */
module.exports = class Reminder extends require("./template.js") {
	static LongTimeout = require("long-timeout");

	/**
	 * Holds all currently active reminders in a Map, keyed by the target recipient user's IDs.
	 * The list of
	 * @type {Map<number, Reminder[]>}
	 */
	static data = new Map();

	/* @type {Map<number, number>} */
	static available = new Map();

	constructor (data) {
		super();

		/**
		 * Unique numeric ID.
		 * @type {number}
		 */
		this.ID = data.ID;

		/**
		 * Whether or not the reminder is still active (primed).
		 * @type {boolean}
		 */
		this.Active = data.Active;

		/**
		 * The user who set the reminder up.
		 * Since anonymous reminders are not supported, this cannot be null.
		 * @type {User.ID}
		 */
		this.User_From = data.User_From;

		/**
		 * The user who the reminder is set up for.
		 * If none is specified, it is a reminder for the origin user themselves.
		 * @type {User.ID}
		 */
		this.User_To = data.User_To || data.User_From;

		/**
		 * The channel the reminder was set up in.
		 * This is necessary for timed reminders, as otherwise it is ambiguous where the reminder should be executed.
		 * @typeof {Channel.ID}
		 */
		this.Channel = data.Channel;

		/**
		 * The text of the reminder.
		 * Can also be null, if the reminder is set up as "ping From when To types a message".
		 * @type {string|null}
		 */
		this.Text = data.Text;

		/**
		 * Date of creation.
		 * @type {CustomDate}
		 */
		this.Created = data.Created;

		/**
		 * Schedule date of reminder, if it's timed.
		 * If null, reminder is tied to a user typing in chat.
		 * @type {CustomDate|null}
		 */
		this.Schedule = data.Schedule;

		/**
		 * If true, the reminder is set to be fired into the user's PMs on the platform they next type in.
		 * If false, regular behaviour is expected
		 * @type {boolean}
		 */
		this.Private_Message = data.Private_Message;

		/**
		 * Platform of the reminder. Can be independent from the channel.
		 * @type {Platform.ID|null}
		 */
		this.Platform = (data.Platform)
			? sb.Platform.get(data.Platform)
			: null;

		/**
		 * If the reminder is a timed one, a timeout will be active that holds the info about the activation.
		 * @type {LongTimeout|null}
		 */
		this.timeout = null;
	}

	activateTimeout () {
		if (!this.Schedule) {
			return this;
		}
		else if (new sb.Date() > this.Schedule) {
			this.deactivate(true);
			return this;
		}

		/** @type {LongTimeout} */
		this.timeout = new Reminder.LongTimeout(async () => {
			const channelData = (this.Channel === null) ? null : sb.Channel.get(this.Channel);
			const fromUserData = await sb.User.get(this.User_From, true);
			const toUserData = await sb.User.get(this.User_To, true);
			let message = null;

			if (this.User_From === this.User_To) {
				message = `@${fromUserData.Name}, reminder from yourself (${sb.Utils.timeDelta(this.Created)}): ${this.Text}`;
			}
			else if (this.User_From === sb.Config.get("SELF_ID")) {
				message = `@${toUserData.Name}, system reminder (${sb.Utils.timeDelta(this.Created)}): ${this.Text}`;
			}
			else if (this.User_To) {
				message = `@${toUserData.Name}, timed reminder from @${fromUserData.Name} (${sb.Utils.timeDelta(this.Created)}): ${this.Text}`;
			}

			const statusAFK = sb.AwayFromKeyboard.get(toUserData);
			if (statusAFK && channelData) {
				await sb.Reminder.create({
					User_From: sb.Config.get("SELF_ID"),
					User_To: toUserData.ID,
					Platform: channelData.Platform.ID,
					Channel: channelData.ID,
					Created: new sb.Date(),
					Active: true,
					Schedule: null,
					Text: `A timed reminder fired while you were AFK, check it here: https://supinic.com/bot/reminder/lookup?ID=${this.ID}`,
					Private_Message: true
				}, true);
			}

			if (message) {
				if (this.Private_Message) {
					const platform = channelData?.Platform ?? this.Platform;
					await platform.pm(message, toUserData);
				}
				else {
					if (channelData === null) {
						throw new sb.Error({
							message: "Cannot post a non-private reminder in an unspecified channel!",
							args: {
								reminderID: this.ID
							}
						});
					}

					await channelData.mirror(message, toUserData, { commandUsed: false });

					const preparedMessage = await channelData.prepareMessage(message);
					if (preparedMessage) {
						await channelData.send(preparedMessage);
					}
				}
			}

			await this.deactivate(true);
		}, Number(this.Schedule), true);

		return this;
	}

	/**
	 * Deactivates a reminder. Also deactivates it in database if required.
	 * @param {boolean} cancelled If true, the reminder will be flagged as cancelled
	 * @param {boolean} permanent If true, the reminder was completed, and can be removed in database.
	 * @returns {Promise<Reminder>}
	 */
	async deactivate (permanent, cancelled) {
		this.Active = false;

		// Always deactivate timed reminder timeout
		if (this.timeout) {
			this.timeout.clear();
		}

		await Reminder.#remove(this.ID, { cancelled, permanent });

		return this;
	}

	destroy () {
		if (this.timeout) {
			this.timeout.clear();
			this.timeout = null;
		}
	}

	async serialize () {
		throw new sb.Error({
			message: "Module Reminder cannot be serialized"
		});
	}

	static async loadData () {
		const data = await sb.Query.getRecordset(rs => rs
			.select("*")
			.from("chat_data", "Reminder")
			.where("Active = %b", true)
		);

		const threshold = new sb.Date().addMonths(1).valueOf();
		for (const row of data) {
			// Skip scheduled reminders that are set to fire more than `threshold` in the future
			if (row.Schedule && row.Schedule.valueOf() > threshold) {
				continue;
			}

			const reminder = new Reminder(row);
			Reminder.#add(reminder);
		}
	}

	static async reloadData () {
		this.clear();
		return await this.loadData();
	}

	static async reloadSpecific (...list) {
		if (list.length === 0) {
			return false;
		}

		const promises = list.map(async (ID) => {
			const row = await sb.Query.getRow("chat_data", "Reminder");
			await row.load(ID);

			await Reminder.#remove(ID, false);

			if (!row.values.Active) {
				return;
			}

			const reminder = new Reminder(row.valuesObject);
			Reminder.#add(reminder);
		});

		await Promise.all(promises);
		return true;
	}

	static get (identifier) {
		if (identifier instanceof Reminder) {
			return identifier;
		}
		else if (typeof identifier === "number") {
			if (!Reminder.available.has(identifier)) {
				return null;
			}

			const userID = Reminder.available.get(identifier);
			const list = Reminder.data.get(userID);
			if (!list) {
				return null;
			}

			return list.find(i => i.ID === identifier) ?? null;
		}
		else {
			throw new sb.Error({
				message: "Unrecognized reminder identifier type",
				args: typeof identifier
			});
		}
	}

	static clear () {
		for (const reminderList of Reminder.data.values()) {
			for (const reminder of reminderList) {
				reminder.destroy();
			}
		}

		Reminder.available.clear();
		Reminder.data.clear();
	}

	static destroy () {
		this.clear();
		super.destroy();
	}

	/**
	 * Creates a new Reminder, and saves it to database.
	 * Used mostly in commands to set up reminders.
	 * @param {Object} data {@link Reminder}-compliant data
	 * @param {boolean} [skipChecks = false] If true, skips all reminder checks. This is done for system reminders, so they always go through.
	 * @return {ReminderCreationResult}
	 */
	static async create (data, skipChecks = false) {
		data.Active = true;

		if (!skipChecks) {
			const { success, cause } = await Reminder.checkLimits(data.User_From, data.User_To, data.Schedule);
			if (!success) {
				return { success, cause };
			}
		}

		if (!data.Platform) {
			console.warn("Creating reminder without platform!");
			data.Platform = 1;
		}

		const row = await sb.Query.getRow("chat_data", "Reminder");
		row.setValues(data);
		await row.save();
		data.ID = row.values.ID;

		const reminder = new Reminder(data);
		Reminder.#add(reminder);

		return {
			success: true,
			cause: null,
			ID: row.values.ID
		};
	}

	/**
	 * @param {User} targetUserData The user ID to check for
	 * @param {Channel} channelData The channel where the reminder was fired
	 */
	static async checkActive (targetUserData, channelData) {
		if (!Reminder.data.has(targetUserData.ID)) {
			return;
		}

		const list = Reminder.data.get(targetUserData.ID);
		if (list.length === 0) {
			return;
		}

		const excludedUserIDs = sb.Filter.getReminderPreventions({
			platform: channelData?.Platform ?? null,
			channel: channelData
		});

		const reminders = list.filter(i => i.Active && !i.Schedule && !excludedUserIDs.includes(i.User_From));
		if (reminders.length === 0) {
			return;
		}

		// Only set the triggering reminders to be inactive in memory. This is a necessary step to avoid re-sending
		// the reminders if tons of messages are being sent at the same time.
		// The reminders will be deactivated properly at the end.
		for (const reminder of reminders) {
			reminder.Active = false;
		}

		const reply = [];
		const privateReply = [];

		for (const reminder of reminders) {
			const platformData = channelData.Platform;
			const fromUserData = await sb.User.get(reminder.User_From);

			let reminderMessage;

			if (reminder.User_From === targetUserData.ID) {
				reminderMessage = `yourself - ${reminder.Text} (${sb.Utils.timeDelta(reminder.Created)})`;
			}
			else if (fromUserData.Name === platformData.Self_Name) {
				reminderMessage = `system reminder - ${reminder.Text} (${sb.Utils.timeDelta(reminder.Created)})`;
			}
			else if (reminder.Text !== null) {
				const mention = channelData.Platform.createUserReminder(fromUserData);
				const { string } = await sb.Banphrase.execute(mention, channelData);

				reminderMessage = `${string} - ${reminder.Text} (${sb.Utils.timeDelta(reminder.Created)})`;
			}
			else {
				const fromUserData = await sb.User.get(reminder.User_From, false);
				const channelName = channelData.getFullName();

				let platform = null;
				if (reminder.Channel) {
					platform = sb.Channel.get(reminder.Channel).Platform;
				}
				else {
					platform = sb.Platform.get(reminder.Platform);
				}

				const authorMention = platform.controller.createUserMention(fromUserData);
				const targetMention = platform.controller.createUserMention(targetUserData);

				const message = `${authorMention}, ${targetMention} just typed in channel ${channelName}`;

				if (reminder.Private_Message) {
					await platform.pm(message, fromUserData);
				}
				else {
					const channelData = sb.Channel.get(reminder.Channel);
					const fixedMessage = await channelData.prepareMessage(message, {
						returnBooleanOnFail: true,
						skipLengthCheck: true
					});

					await channelData.send(fixedMessage);
				}
			}

			if (reminderMessage) {
				if (reminder.Private_Message) {
					privateReply.push(reminderMessage);
				}
				else {
					const checked = await channelData.prepareMessage(reminderMessage);
					reply.push(checked);
				}
			}
		}

		const targetUserMention = channelData.Platform.createUserMention(targetUserData);
		const checkResult = await channelData.prepareMessage(targetUserMention, {
			returnBooleanOnFail: true,
			skipLengthCheck: true
		});

		const userMention = (checkResult === false) ? "[Banphrased username]," : `${checkResult},`;

		// Handle non-private reminders
		if (reply.length !== 0) {
			const noun = (reply.length === 1) ? "reminder" : "reminders";
			let message = `${noun} from: ${reply.join("; ")}`;

			if (channelData.Links_Allowed === false) {
				message = sb.Utils.replaceLinks(message, "[LINK]");
			}

			// Check banphrases and do not check length limits, because it is later split manually
			message = await channelData.prepareMessage(message, {
				returnBooleanOnFail: true,
				skipLengthCheck: true
			});

			if (typeof message === "string" && !message.includes("[LINK]")) {
				message = `${userMention} ${message}`;

				// Apply unpings, governed by the reminder command itself
				message = sb.Filter.applyUnping({
					command: sb.Command.get("remind"),
					channel: channelData ?? null,
					platform: channelData?.Platform ?? null,
					string: message,
					executor: targetUserData
				});

				const limit = channelData.Message_Limit ?? channelData.Platform.Message_Limit;

				// If the result message would be longer than twice the channel limit, post a list of reminder IDs
				// instead along with a link to the website, where the user can check them out.
				if (message.length > limit) {
					const listID = reminders.filter(i => !i.Private_Message).map(i => `ID=${i.ID}`).join("&");
					const link = await Reminder.createRelayLink("lookup", listID);

					message = sb.Utils.tag.trim `
						Hey ${userMention},
						you have reminders, but they're too long to be posted here. 
						Check them out here: ${link}
					`;
				}

				const [resultMessage] = sb.Utils.partitionString(message, limit, 1);
				await Promise.all([
					channelData.send(resultMessage),
					channelData.mirror(resultMessage, targetUserData, { commandUsed: false })
				]);
			}
			else {
				const listID = reminders.map(i => `ID=${i.ID}`).join("&");
				const link = await Reminder.createRelayLink("lookup", listID);

				const message = sb.Utils.tag.trim `
					Hey ${userMention},
					you just got reminders, but they couldn't be displayed here.
					Instead, check them out here: ${link}
				`;

				await channelData.send(message);
			}
		}

		// Handle private reminders
		if (privateReply.length !== 0) {
			for (const privateReminder of privateReply) {
				await channelData.Platform.pm(`Private reminder: ${privateReminder}`, targetUserData, channelData);
			}

			const publicMessage = `Hey ${userMention} - I just private messaged you ${privateReply.length} private reminder(s) - make sure to check them out!`;
			await Promise.all([
				channelData.send(publicMessage),
				channelData.mirror(publicMessage, targetUserData, { commandUsed: false })
			]);
		}

		// Properly deactivate all reminders here - after all work has been done.
		const deactivatePromises = reminders.map(reminder => reminder.deactivate(true));
		await Promise.all(deactivatePromises);

		Reminder.data.delete(targetUserData.ID);
	}

	/**
	 * Checks whether or not it is possible to set up a reminder for given user, respecting limits.
	 * Used mostly in commands to set up reminders.
	 * @param {number} userFrom
	 * @param {number} userTo
	 * @param {CustomDate} [schedule]
	 * @return {ReminderCreationResult}
	 */
	static async checkLimits (userFrom, userTo, schedule) {
		const [incomingData, outgoingData] = await Promise.all([
			sb.Query.getRecordset(rs => rs
				.select("Private_Message")
				.from("chat_data", "Reminder")
				.where("Active = %b", true)
				.where("Schedule IS NULL")
				.where("User_To = %n", userTo)
			),
			sb.Query.getRecordset(rs => rs
				.select("Private_Message")
				.from("chat_data", "Reminder")
				.where("Active = %b", true)
				.where("Schedule IS NULL")
				.where("User_From = %n", userFrom)
			)
		]);

		const incomingLimit = sb.Config.get("MAX_ACTIVE_INCOMING_REMINDERS", false) ?? 10;
		const outgoingLimit = sb.Config.get("MAX_ACTIVE_OUTGOING_REMINDERS", false) ?? 10;
		const [privateIncoming, publicIncoming] = sb.Utils.splitByCondition(incomingData, i => i.Private_Message);
		const [privateOutgoing, publicOutgoing] = sb.Utils.splitByCondition(outgoingData, i => i.Private_Message);

		if (publicIncoming.length >= incomingLimit) {
			return {
				success: false,
				cause: "public-incoming"
			};
		}
		else if (publicOutgoing.length >= outgoingLimit) {
			return {
				success: false,
				cause: "public-outgoing"
			};
		}
		else if (privateIncoming.length >= incomingLimit) {
			return {
				success: false,
				cause: "private-outgoing"
			};
		}
		else if (privateOutgoing.length >= outgoingLimit) {
			return {
				success: false,
				cause: "private-outgoing"
			};
		}

		if (schedule) {
			const incomingScheduledLimit = sb.Config.get("MAX_ACTIVE_SCHEDULED_INCOMING_REMINDERS", false) ?? 5;
			const outgoingScheduledLimit = sb.Config.get("MAX_ACTIVE_SCHEDULED_OUTGOING_REMINDERS", false) ?? 5;
			if (!(schedule instanceof sb.Date)) {
				throw new sb.Error({
					message: "Invalid schedule provided",
					args: { schedule, userFrom, userTo }
				});
			}

			const [scheduledIncoming, scheduledOutgoing] = await Promise.all([
				sb.Query.getRecordset(rs => rs
					.select("COUNT(*) AS Count")
					.from("chat_data", "Reminder")
					.where("Active = %b", true)
					.where("Schedule IS NOT NULL")
					.where("User_To = %n", userTo)
					.where("DAY(Schedule) = %n", schedule.day)
					.where("MONTH(Schedule) = %n", schedule.month)
					.where("YEAR(Schedule) = %n", schedule.year)
					.groupBy("YEAR(Schedule)", "MONTH(Schedule)", "DAY(Schedule)")
					.single()
					.flat("Count")
				),
				sb.Query.getRecordset(rs => rs
					.select("COUNT(*) AS Count")
					.from("chat_data", "Reminder")
					.where("Active = %b", true)
					.where("Schedule IS NOT NULL")
					.where("User_From = %n", userFrom)
					.where("DAY(Schedule) = %n", schedule.day)
					.where("MONTH(Schedule) = %n", schedule.month)
					.where("YEAR(Schedule) = %n", schedule.year)
					.groupBy("YEAR(Schedule)", "MONTH(Schedule)", "DAY(Schedule)")
					.single()
					.flat("Count")
				)
			]);

			if (scheduledIncoming >= incomingScheduledLimit) {
				return {
					success: false,
					cause: "scheduled-incoming"
				};
			}
			else if (scheduledOutgoing >= outgoingScheduledLimit) {
				return {
					success: false,
					cause: "scheduled-outgoing"
				};
			}
		}

		return {
			success: true
		};
	}

	static async createRelayLink (endpoint, params) {
		const relay = await sb.Got("Supinic", {
			method: "POST",
			url: "relay",
			throwHttpErrors: false,
			json: {
				url: `/bot/reminder/${endpoint}?${params}`
			}
		});

		let link;
		if (relay.statusCode === 200) {
			link = relay.body.data.link;
		}
		else {
			console.warn("Relay creation failed", { relay, params });
			link = `https://supinic.com/bot/reminder/${endpoint}?${params}`;
		}

		return link;
	}

	/**
	 * @private
	 * @param {Reminder} reminder
	 */
	static #add (reminder) {
		if (!Reminder.data.has(reminder.User_To)) {
			Reminder.data.set(reminder.User_To, []);
		}

		Reminder.available.set(reminder.ID, reminder.User_To);
		Reminder.data.get(reminder.User_To).push(reminder);

		reminder.activateTimeout();
	}

	/**
	 * @private
	 * @param {number} ID
	 * @param {Object} options
	 * @param {boolean} [options.cancelled] If `true`, the reminder will be flagged as "Cancelled"
	 * @param {boolean} [options.permanent] If `true`, the reminder will also be removed/deactivated in the database as well
	 * @returns {Promise<boolean>} whether or not the changes were applied
	 */
	static async #remove (ID, options = {}) {
		const { cancelled, permanent } = options;
		if (permanent) {
			const row = await sb.Query.getRow("chat_data", "Reminder");
			await row.load(ID, true);

			if (row.loaded) {
				row.values.Active = false;
				row.values.Cancelled = Boolean(cancelled);

				await row.save({ skipLoad: true });
			}
		}

		if (!Reminder.available.has(ID)) {
			return false;
		}

		const targetUserID = Reminder.available.get(ID);
		const list = Reminder.data.get(targetUserID);
		if (!list) {
			return false;
		}

		const index = list.findIndex(i => i.ID === ID);
		if (index === -1) {
			return false;
		}

		const reminder = list[index];
		reminder.destroy();
		list.splice(index, 1);

		Reminder.available.delete(ID);

		return true;
	}
};

/**
 * @typedef {Object} ReminderCreationResult
 * @property {boolean} success Whether or not the reminder was created .
 * @property {number} [ID] If successful, this is the new reminder ID.
 * @property {string} [cause] If not successful, this is a string specifying what went wrong.
 */
