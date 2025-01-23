import config from "../config.json" with { type: "json" };

import AwayFromKeyboard from "./afk.js";
import Banphrase from "./banphrase.js";
import Channel from "./channel.js";
import Command from "./command.js";
import Filter from "./filter.js";
import User from "./user.js";
import Template from "./template.js";

import Platform from "../platforms/template.js";
import LongTimeout from "../utils/long-timeout.js";

/**
 * Represents a pending reminder from (usually) one user to another.
 * An active reminder will be printed into the chat once the target user is spotted.
 */
export default class Reminder extends Template {
	/**
	 * Holds all currently active reminders in a Map, keyed by the target recipient user's IDs.
	 * The list of
	 * @type {Map<User.ID, Reminder[]>}
	 */
	static data = new Map();
	static uniqueIdentifier = "ID";

	/* @type {Map<Reminder.ID, User.ID>} */
	static available = new Map();

	static #activeGauge;
	static #userGauge;
	static #limitRejectedCounter;
	static #totalCounter;

	constructor (data) {
		super();

		/**
		 * Unique numeric ID.
		 * @type {number}
		 */
		this.ID = data.ID;

		/**
		 * The user who set the reminder up.
		 * Since anonymous reminders are not supported, this cannot be null.
		 * @type {User["ID"]}
		 */
		this.User_From = data.User_From;

		/**
		 * The user who the reminder is set up for.
		 * If none is specified, it is a reminder for the origin user themselves.
		 * @type {User["ID"]}
		 */
		this.User_To = data.User_To || data.User_From;

		/**
		 * The channel the reminder was set up in.
		 * This is necessary for timed reminders, as otherwise it is ambiguous where the reminder should be executed.
		 * @type {Channel["ID"]}
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
		 * @type {CoreDate}
		 */
		this.Created = data.Created;

		/**
		 * Schedule date of reminder, if it's timed.
		 * If null, reminder is tied to a user typing in chat.
		 * @type {CoreDate|null}
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
		 * @type {Platform|null}
		 */
		this.Platform = (data.Platform)
			? Platform.get(data.Platform)
			: null;

		/**
		 * The type of the reminder, whether it reminds the target ("regular reminder") or the author
		 * ("pingme reminder" - the author will be pinged when the target user types somewhere)
		 * @type {"Reminder"|"Pingme"}
		 */
		this.Type = data.Type;

		/**
		 * If the reminder is a timed one, a timeout will be active that holds the info about the activation.
		 * @type {LongTimeout|null}
		 */
		this.timeout = null;

		this.deactivated = false;
	}

	activateTimeout () {
		if (!this.Schedule || this.Type === "Deferred") {
			return this;
		}
		else if (new sb.Date() > this.Schedule) {
			this.deactivate(true);
			return this;
		}

		this.timeout = new LongTimeout(async () => {
			const channelData = (this.Channel === null) ? null : Channel.get(this.Channel);
			const fromUserData = (this.User_From) ? await User.get(this.User_From, true) : null;
			const toUserData = await User.get(this.User_To, true);

			const fromMention = (fromUserData)
				? await this.Platform.createUserMention(fromUserData, channelData)
				: null;
			const toMention = await this.Platform.createUserMention(toUserData, channelData);

			let message;
			if (this.User_From === this.User_To) {
				message = `${toMention}, reminder from yourself (${sb.Utils.timeDelta(this.Created)}): ${this.Text}`;
			}
			else if (!this.User_From) {
				message = `${toMention}, system reminder (${sb.Utils.timeDelta(this.Created)}): ${this.Text}`;
			}
			else if (this.User_To) {
				message = `${toMention}, timed reminder from ${fromMention} (${sb.Utils.timeDelta(this.Created)}): ${this.Text}`;
			}

			const statusAFK = AwayFromKeyboard.get(toUserData);
			if (statusAFK && channelData) {
				await Reminder.create({
					User_From: null,
					User_To: toUserData.ID,
					Platform: channelData.Platform.ID,
					Channel: channelData.ID,
					Created: new sb.Date(),
					Schedule: null,
					Text: `You got a scheduled reminder (ID ${this.ID}) while you were AFK: ${message}`,
					Private_Message: true
				}, true);
			}

			if (message) {
				if (this.Private_Message) {
					await this.Platform.pm(message, toUserData);
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

					if (channelData.Mirror) {
						let mirrorMessage;
						if (this.User_From === this.User_To) {
							mirrorMessage = `${toUserData.Name}, reminder from yourself (${sb.Utils.timeDelta(this.Created)}): ${this.Text}`;
						}
						else if (!this.User_From) {
							mirrorMessage = `${toUserData.Name}, system reminder (${sb.Utils.timeDelta(this.Created)}): ${this.Text}`;
						}
						else if (this.User_To) {
							mirrorMessage = `${toUserData.Name}, timed reminder from ${fromUserData.Name} (${sb.Utils.timeDelta(this.Created)}): ${this.Text}`;
						}

						await channelData.mirror(mirrorMessage, null, { commandUsed: false });
					}

					const preparedMessage = await channelData.prepareMessage(message);
					if (preparedMessage) {
						const fixedMessage = await Filter.applyUnping({
							command: Command.get("remind"),
							channel: channelData ?? null,
							platform: channelData?.Platform ?? null,
							string: preparedMessage,
							executor: fromUserData
						});

						await channelData.send(fixedMessage);
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

	static async initialize () {
		if (sb.Metrics) {
			Reminder.#limitRejectedCounter = sb.Metrics.registerCounter({
				name: "supibot_reminders_limit_rejected_total",
				help: "Total amount of all reminders that have not been registered due to a limit being hit.",
				labelNames: ["cause"]
			});

			Reminder.#totalCounter = sb.Metrics.registerCounter({
				name: "supibot_reminders_created_total",
				help: "Total amount of all reminders created.",
				labelNames: ["type", "scheduled", "system"]
			});

			Reminder.#activeGauge = sb.Metrics.registerGauge({
				name: "supibot_active_reminders_count",
				help: "Total amount of currently active reminders."
			});

			Reminder.#userGauge = sb.Metrics.registerGauge({
				name: "supibot_reminder_recipient_user_count",
				help: "Total amount of users that currently have at least one reminder pending for them."
			});
		}

		return await super.initialize();
	}

	static async loadData () {
		const data = await sb.Query.getRecordset(rs => rs
			.select("*")
			.from("chat_data", "Reminder")
		);

		const threshold = new sb.Date().addYears(10).valueOf();
		for (const row of data) {
			// Skip scheduled reminders that are set to fire more than `threshold` in the future
			if (row.Schedule && row.Schedule.valueOf() > threshold) {
				continue;
			}

			const reminder = new Reminder(row);
			Reminder.#add(reminder);
		}

		if (sb.Metrics) {
			Reminder.#activeGauge.set(Reminder.available.size);
			Reminder.#userGauge.set(Reminder.data.size);
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
			await row.load(ID, true);

			await Reminder.#remove(ID);

			if (!row.loaded) {
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
	 */
	static async create (data, skipChecks = false) {
		if (!skipChecks) {
			const { success, cause } = await Reminder.checkLimits(data.User_From, data.User_To, data.Schedule, data.Type);
			if (!success) {
				if (sb.Metrics) {
					Reminder.#limitRejectedCounter.inc({ cause });
				}

				return { success, cause };
			}
		}

		if (!data.User_To || !data.Platform) {
			throw new sb.Error({
				message: "Missing Reminder constructor option User_To and/or Platform",
				args: { data }
			});
		}
		else if (data.User_From !== null && typeof data.User_From !== "number") {
			throw new sb.Error({
				message: "Invalid Reminder constructor option User_From",
				args: { data }
			});
		}

		const row = await sb.Query.getRow("chat_data", "Reminder");
		row.setValues({
			User_From: data.User_From,
			User_To: data.User_To,
			Channel: data.Channel ?? null,
			Text: data.Text ?? null,
			Created: new sb.Date(),
			Schedule: data.Schedule ?? null,
			Private_Message: data.Private_Message ?? false,
			Platform: data.Platform,
			Type: data.Type ?? "Reminder"
		});

		await row.save({ skipLoad: false });

		const reminder = new Reminder(row.valuesObject);
		Reminder.#add(reminder);

		if (sb.Metrics) {
			Reminder.#totalCounter.inc({
				type: row.values.Type,
				scheduled: Boolean(row.values.Schedule),
				system: skipChecks
			});

			Reminder.#activeGauge.set(Reminder.available.size);
			Reminder.#userGauge.set(Reminder.data.size);
		}

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

		const excludedUserIDs = Filter.getReminderPreventions({
			platform: channelData?.Platform ?? null,
			channel: channelData
		});

		const now = sb.Date.now();
		const reminders = list.filter(i => (
			!i.deactivated
			&& ((i.Type === "Deferred" && i.Schedule <= now) || (i.Type !== "Deferred" && !i.Schedule))
			&& !excludedUserIDs.includes(i.User_From)
		));

		if (reminders.length === 0) {
			return;
		}

		// Only set the triggering reminders to be inactive in memory. This is a necessary step to avoid re-sending
		// the reminders if tons of messages are being sent at the same time.
		// The reminders will be deactivated properly at the end.
		for (const reminder of reminders) {
			reminder.deactivated = true;
		}

		const reply = [];
		const privateReply = [];

		for (const reminder of reminders) {
			const fromUserData = (reminder.User_From)
				? await User.get(reminder.User_From)
				: null;

			if (reminder.Type === "Pingme") {
				const fromUserData = await User.get(reminder.User_From, false);
				const isChannelStalkOptedOut = await channelData.getDataProperty("stalkPrevention");

				const channelStringName = (isChannelStalkOptedOut === true)
					? "[EXPUNGED]"
					: channelData.getFullName();

				let platform = null;
				if (reminder.Channel) {
					platform = Channel.get(reminder.Channel).Platform;
				}
				else {
					platform = Platform.get(reminder.Platform);
				}

				const uncheckedAuthorMention = await platform.createUserMention(fromUserData);
				const authorBanphraseCheck = await sb.Banphrase.execute(uncheckedAuthorMention, channelData);
				const authorMention = (authorBanphraseCheck.passed) ? `${uncheckedAuthorMention}` : "[Banphrased username]";

				const targetMention = await platform.createUserMention(targetUserData);
				let message = `${authorMention}, ${targetMention} just typed in channel ${channelStringName}`;

				if (reminder.Text) {
					message += `: ${reminder.Text}`;
				}

				if (reminder.Private_Message) {
					await platform.pm(message, fromUserData);
				}
				else {
					const channelData = Channel.get(reminder.Channel);
					const banphraseResult = await sb.Banphrase.execute(message, channelData);

					if (!banphraseResult.passed) {
						await channelData.send(sb.Utils.tag.trim `
							${authorMention},
							a user you set up a "pingme" reminder for has typed somewhere, but I can't post it here.
							I have whispered you the result instead.
						`);

						await platform.pm(message, fromUserData.Name, channelData);
					}
					else {
						const fixedMessage = await Filter.applyUnping({
							command: Command.get("remind"),
							channel: channelData ?? null,
							platform: channelData?.Platform ?? null,
							string: banphraseResult.string,
							executor: fromUserData
						});

						await channelData.send(fixedMessage);
					}
				}

				// Pingme reminders do not follow the regular reminder logic, so continue to next iteration.
				continue;
			}

			const reminderTextCheck = await Banphrase.execute(reminder.Text, channelData);
			const reminderText = (reminderTextCheck.passed) ? reminder.Text : "[Banphrased]";
			const delta = sb.Utils.timeDelta(reminder.Created);

			let reminderMessage;
			if (reminder.User_From === targetUserData.ID) {
				reminderMessage = `yourself - ${reminderText} (${delta})`;
			}
			else if (!fromUserData) {
				reminderMessage = `system reminder - ${reminderText} (${delta})`;
			}
			else if (reminder.Text !== null) {
				const mention = await channelData.Platform.createUserMention(fromUserData);
				const mentionResult = await Banphrase.execute(mention, channelData);
				const checkedeMention = (mentionResult.passed) ? mention : "[Banphrased username]";

				reminderMessage = `${checkedeMention} - ${reminderText} (${delta})`;
			}

			if (reminder.Private_Message) {
				privateReply.push(reminderMessage);
			}
			else {
				reply.push(reminderMessage);
			}
		}

		const targetUserMention = await channelData.Platform.createUserMention(targetUserData);
		const targetUserCheck = await sb.Banphrase.execute(targetUserMention, channelData);
		const userMention = (targetUserCheck.passed) ? `${targetUserMention},` : "[Banphrased username],";

		// Handle non-private reminders
		if (reply.length !== 0) {
			let message = `reminder(s) from: ${reply.join("; ")}`;

			if (channelData.Links_Allowed === false) {
				message = sb.Utils.replaceLinks(message, "[LINK]");
			}

			// Check banphrases and do not check length limits, because it is later split manually
			const messageCheck = await sb.Banphrase.execute(message, channelData);

			if (messageCheck.passed && !messageCheck.string.includes("[LINK]")) {
				message = messageCheck.string;

				let mirrorMessage = `${targetUserData.Name} ${message}`;
				message = `${userMention} ${message}`;

				// Apply unpings, governed by the reminder command itself
				message = await Filter.applyUnping({
					command: Command.get("remind"),
					channel: channelData ?? null,
					platform: channelData?.Platform ?? null,
					string: message,
					executor: targetUserData
				});

				const limit = channelData.Message_Limit ?? channelData.Platform.Message_Limit;

				// If the result message would be longer than twice the channel limit, post a list of reminder IDs
				// instead along with a link to the website, where the user can check them out.
				if (message.length > limit) {
					const reminderIDs = reminders.filter(i => !i.Private_Message).map(i => i.ID);
					const listID = reminderIDs.map(i => `ID=${i}`).join("&");
					const link = (channelData.Links_Allowed)
						? await Reminder.createRelayLink("lookup", listID)
						: "[LINK]";

					message = sb.Utils.tag.trim `
						Hey ${userMention}
						you have ${reminderIDs.length} reminders, but they're too long to be posted.
						Check them here: ${link}
						or by ID: ${reminderIDs.join(" ")}
					`;
					mirrorMessage = sb.Utils.tag.trim `
						Hey ${targetUserData.Name}
						you have ${reminderIDs.length} reminders, but they're too long to be posted.
						Check them here: ${link}
						or by ID: ${reminderIDs.join(" ")}
					`;
				}

				const [resultMessage] = sb.Utils.partitionString(message, limit, 1);
				await Promise.all([
					channelData.send(resultMessage),
					channelData.mirror(mirrorMessage, null, { commandUsed: false })
				]);
			}
			else {
				const reminderIDs = reminders.filter(i => !i.Private_Message).map(i => i.ID);
				const listID = reminderIDs.map(i => `ID=${i}`).join("&");
				const link = (channelData.Links_Allowed)
					? await Reminder.createRelayLink("lookup", listID)
					: "[LINK]";

				const resultMessage = sb.Utils.tag.trim `
					Hey ${userMention}
					you have ${reminderIDs.length} reminders, but they couldn't be posted.
					Check them here: ${link}
					or by ID: ${reminderIDs.join(" ")}
				`;
				const mirrorMessage = sb.Utils.tag.trim `
					Hey ${targetUserData.Name}
					you have ${reminderIDs.length} reminders, but they couldn't be posted.
					Check them here: ${link}
					or by ID: ${reminderIDs.join(" ")}
				`;

				await Promise.all([
					channelData.send(resultMessage),
					channelData.mirror(mirrorMessage, null, { commandUsed: false })
				]);
			}
		}

		// Handle private reminders
		if (privateReply.length !== 0) {
			for (const privateReminder of privateReply) {
				await channelData.Platform.pm(`Private reminder: ${privateReminder}`, targetUserData, channelData);
			}

			const publicMessage = `Hey ${userMention} - I just private messaged you ${privateReply.length} private reminder(s) - make sure to check them out!`;
			const publicMirrorMessage = `Hey ${targetUserData.Name} - I just private messaged you ${privateReply.length} private reminder(s) - make sure to check them out!`;

			await Promise.all([
				channelData.send(publicMessage),
				channelData.mirror(publicMirrorMessage, null, { commandUsed: false })
			]);
		}

		// Properly deactivate all reminders here - after all work has been done.
		const deactivatePromises = reminders.map(reminder => reminder.deactivate(true));
		await Promise.all(deactivatePromises);

		if (sb.Metrics) {
			Reminder.#activeGauge.set(Reminder.available.size);
			Reminder.#userGauge.set(Reminder.data.size);
		}
	}

	/**
	 * Checks whether or not it is possible to set up a reminder for given user, respecting limits.
	 * Used mostly in commands to set up reminders.
	 * @param {number} userFrom
	 * @param {number} userTo
	 * @param {sb.Date} [schedule]
	 * @param {string} [type]
	 * @return {ReminderCreationResult}
	 */
	static async checkLimits (userFrom, userTo, schedule, type = "Reminder") {
		const [incomingData, outgoingData] = await Promise.all([
			sb.Query.getRecordset(rs => rs
				.select("Private_Message")
				.from("chat_data", "Reminder")
				.where("(Type = %s AND Schedule IS NULL) OR (Type = %s AND Schedule IS NOT NULL)", "Reminder", "Deferred")
				.where("User_To = %n", userTo)
			),
			sb.Query.getRecordset(rs => rs
				.select("Private_Message")
				.from("chat_data", "Reminder")
				.where("Schedule IS NULL")
				.where("(Type = %s AND Schedule IS NULL) OR (Type = %s AND Schedule IS NOT NULL)", "Reminder", "Deferred")
				.where("User_From = %n", userFrom)
			)
		]);

		const incomingLimit = config.values.maxIncomingActiveReminders;
		const outgoingLimit = config.values.maxOutgoingActiveReminders;
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
			const incomingScheduledLimit = config.values.maxIncomingScheduledReminders;
			const outgoingScheduledLimit = config.values.maxOutgoingScheduledReminders;
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
					.where("Schedule IS NOT NULL")
					.where("User_To = %n", userTo)
					.where("Type <> %s", "Deferred")
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
					.where("Schedule IS NOT NULL")
					.where("User_From = %n", userFrom)
					.where("Type <> %s", "Deferred")
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

		if (type === "Pingme") {
			const existingPingmeReminderID = await sb.Query.getRecordset(rs => rs
				.select("ID")
				.from("chat_data", "Reminder")
				.where("Type = %s", "Pingme")
				.where("User_From = %n", userFrom)
				.where("User_To = %n", userTo)
				.flat("ID")
				.single()
			);

			if (existingPingmeReminderID) {
				return {
					success: false,
					cause: "existing-pingme"
				};
			}
		}

		return {
			success: true
		};
	}

	static async createRelayLink (endpoint, params) {
		const relay = await sb.Got.get("Supinic")({
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
				const historyRow = await sb.Query.getRow("chat_data", "Reminder_History");

				historyRow.setValues({
					ID,
					User_From: row.values.User_From,
					User_To: row.values.User_To,
					Channel: row.values.Channel,
					Platform: row.values.Platform,
					Type: row.values.Type,
					Text: row.values.Text,
					Created: row.values.Created,
					Schedule: row.values.Schedule,
					Private_Message: row.values.Private_Message,
					Cancelled: Boolean(cancelled)
				});

				await historyRow.save({ skipLoad: true });
				await row.delete();
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
