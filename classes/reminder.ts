import { SupiDate, SupiError, type Counter, type Gauge } from "supi-core";

import config from "../config.json" with { type: "json" };

import AwayFromKeyboard from "./afk.js";
import Banphrase from "./banphrase.js";
import Channel from "./channel.js";
import { Command } from "./command.js";
import Filter from "./filter.js";
import User from "./user.js";
import { TemplateWithId } from "./template.js";

import Platform from "../platforms/template.js";
import LongTimeout from "../utils/long-timeout.js";

type Type = "Reminder" | "Pingme" | "Deferred";
type ConstructorData = Pick<Reminder, "ID" | "User_From" | "User_To" | "Channel" | "Text" | "Created" | "Schedule" | "Private_Message" | "Type"> & {
	Platform: number;
};
type HistoryConstructorData = ConstructorData & { Cancelled: boolean; };

type CreateData = Omit<ConstructorData, "ID">;
type CreateResult = {
	success: boolean;
	cause: string | null,
	ID?: Reminder["ID"] | null;
};
type LimitCheckResult = { success: true; } | { success: false; cause: string; };

/**
 * Represents a pending reminder from (usually) one user to another.
 * An active reminder will be printed into the chat once the target user is spotted.
 */
export class Reminder extends TemplateWithId {
	/**
	 * Unique numeric ID.
	 */
	readonly ID: number;
	/**
	 * The user who set the reminder up.
	 * When `null`, the User_From property signifies the instance is a system reminder.
	 */
	readonly User_From: User["ID"] | null;
	/**
	 * The user who the reminder is set up for.
	 * If none is specified, it is a reminder for the origin user themselves.
	 */
	readonly User_To: User["ID"];
	/**
	 * The channel the reminder was set up in.
	 * This is necessary for timed reminders, as otherwise it is ambiguous where the reminder should be executed.
	 */
	readonly Channel: Channel["ID"] | null;
	/**
	 * The text of the reminder.
	 * Can also be null, if the reminder is set up as "ping `From` when `To` types a message".
	 */
	readonly Text: string | null;
	/**
	 * Date of creation.
	 */
	readonly Created: SupiDate;
	/**
	 * Schedule date of reminder, if it's timed.
	 * If null, reminder is tied to a user typing in chat.
	 */
	readonly Schedule: SupiDate | null;
	/**
	 * If `true`, the reminder is set to be fired into the user's PMs on the platform they next type in.
	 * If `false`, regular behaviour is expected.
	 */
	readonly Private_Message: boolean;
	/**
	 * Platform of the reminder. Can be independent of the channel.
	 */
	readonly Platform: Platform;
	/**
	 * The type of the reminder:
	 * - "Reminder" reminds the target when they type in chat, or after some time
	 * - "Pingme" reminds the author when the target types in chat
	 * - "Deferred" reminds the target when they type after some time passed
	 */
	readonly Type: Type;

	/**
	 * If the reminder is a timed one, a timeout will be active that holds the info about the activation.
	 */
	timeout: LongTimeout | null = null;
	deactivated: boolean = false;

	/**
	 * Holds all currently active reminders in a Map, keyed by the target recipient user's IDs.
	 */
	static data: Map<User["ID"], Reminder[]> = new Map();
	static uniqueIdentifier = "ID";

	/* @type {Map<Reminder.ID, User.ID>} */
	static available: Map<Reminder["ID"], User["ID"]> = new Map();

	static #activeGauge: Gauge;
	static #userGauge: Gauge;
	static #limitRejectedCounter: Counter<"cause">;
	static #totalCounter: Counter<"type" | "scheduled" | "system">;

	constructor (data: ConstructorData) {
		super();

		this.ID = data.ID;
		this.User_From = data.User_From;
		this.User_To = data.User_To;
		this.Channel = data.Channel;
		this.Text = data.Text;
		this.Created = data.Created;
		this.Schedule = data.Schedule;
		this.Private_Message = data.Private_Message;
		this.Type = data.Type;

		const platformData = Platform.get(data.Platform);
		if (!platformData) {
			throw new SupiError({
				message: "Unknown platform provided for Reminder",
				args: { data }
			});
		}

		this.Platform = platformData;
	}

	activateTimeout () {
		if (!this.Schedule || this.Type === "Deferred") {
			return this;
		}
		else if (new SupiDate() > this.Schedule) {
			void this.deactivate(true, false);
			return this;
		}

		this.timeout = new LongTimeout(async () => {
			const channelData = (this.Channel === null) ? null : Channel.get(this.Channel);
			const fromUserData = (this.User_From) ? await User.get(this.User_From, true) : null;
			const toUserData = await User.get(this.User_To, true);
			if (!toUserData) {
				throw new SupiError({
					message: "Reminder has no valid target user set up",
					args: { user: this.User_To }
				});
			}

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
					Created: new SupiDate(),
					Schedule: null,
					Type: "Reminder",
					Text: `You got a scheduled reminder (ID ${this.ID}) while you were AFK: ${message}`,
					Private_Message: true
				}, true);
			}

			if (message) {
				if (this.Private_Message) {
					await this.Platform.pm(message, toUserData);
				}
				else {
					if (!channelData) {
						throw new SupiError({
							message: "Cannot post a non-private reminder in an unspecified channel!",
							args: {
								reminderID: this.ID
							}
						});
					}

					if (channelData.Mirror) {
						let mirrorMessage: string;
						if (this.User_From === this.User_To) {
							mirrorMessage = `${toUserData.Name}, reminder from yourself (${sb.Utils.timeDelta(this.Created)}): ${this.Text}`;
						}
						else if (!this.User_From) {
							mirrorMessage = `${toUserData.Name}, system reminder (${sb.Utils.timeDelta(this.Created)}): ${this.Text}`;
						}
						else if (this.User_To && fromUserData) {
							mirrorMessage = `${toUserData.Name}, timed reminder from ${fromUserData.Name} (${sb.Utils.timeDelta(this.Created)}): ${this.Text}`;
						}
						else {
							throw new SupiError({
								message: "Invalid combination of parameters in Reminder"
							});
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

			await this.deactivate(true, false);
		}, Number(this.Schedule), true);

		return this;
	}

	/**
	 * Deactivates a reminder. Also deactivates it in database if required.
	 * @param cancelled If true, the reminder will be flagged as cancelled
	 * @param permanent If true, the reminder was completed, and can be removed in database.
	 */
	async deactivate (permanent: boolean, cancelled: boolean) {
		// Always deactivate timed reminder timeout
		if (this.timeout) {
			this.timeout.clear();
		}

		await Reminder.#remove(this.ID, { cancelled, permanent });
		return this;
	}

	getCacheKey (): never {
		throw new SupiError({
			message: "Reminder module does not support `getCacheKey`"
		});
	}

	destroy () {
		if (this.timeout) {
			this.timeout.clear();
			this.timeout = null;
		}
	}

	static async initialize () {
		Reminder.#limitRejectedCounter = sb.Metrics.registerCounter({
			name: "supibot_reminders_limit_rejected_total",
			help: "Total amount of all reminders that have not been registered due to a limit being hit.",
			labelNames: ["cause"] as const
		});

		Reminder.#totalCounter = sb.Metrics.registerCounter({
			name: "supibot_reminders_created_total",
			help: "Total amount of all reminders created.",
			labelNames: ["type", "scheduled", "system"] as const
		});

		Reminder.#activeGauge = sb.Metrics.registerGauge({
			name: "supibot_active_reminders_count",
			help: "Total amount of currently active reminders."
		});

		Reminder.#userGauge = sb.Metrics.registerGauge({
			name: "supibot_reminder_recipient_user_count",
			help: "Total amount of users that currently have at least one reminder pending for them."
		});

		return await super.initialize();
	}

	static async loadData () {
		const data = await sb.Query.getRecordset<ConstructorData[]>(rs => rs
			.select("*")
			.from("chat_data", "Reminder")
		);

		const threshold = new SupiDate().addYears(10).valueOf();
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

	static async reloadSpecific (...list: Reminder["ID"][]) {
		if (list.length === 0) {
			return false;
		}

		const promises = list.map(async (ID) => {
			const row = await sb.Query.getRow<ConstructorData>("chat_data", "Reminder");
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

	static get (identifier: Reminder | Reminder["ID"]) {
		if (identifier instanceof Reminder) {
			return identifier;
		}
		else {
			const userID = Reminder.available.get(identifier);
			if (typeof userID !== "number") {
				return null;
			}

			const list = Reminder.data.get(userID);
			if (!list) {
				return null;
			}

			return list.find(i => i.ID === identifier) ?? null;
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
	}

	/**
	 * Creates a new Reminder, and saves it to database.
	 * Used mostly in commands to set up reminders.
	 */
	static async create (data: CreateData, skipChecks = false): Promise<CreateResult> {
		if (!skipChecks && data.User_From !== null) {
			const limitResult = await Reminder.checkLimits(data.User_From, data.User_To, data.Schedule, data.Type);
			if (!limitResult.success) {
				if (sb.Metrics) {
					Reminder.#limitRejectedCounter.inc({
						cause: limitResult.cause
					});
				}

				return limitResult;
			}
		}

		const row = await sb.Query.getRow<ConstructorData>("chat_data", "Reminder");
		row.setValues({
			User_From: data.User_From,
			User_To: data.User_To,
			Channel: data.Channel ?? null,
			Text: data.Text ?? null,
			Created: new SupiDate(),
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
				scheduled: String(Boolean(row.values.Schedule)),
				system: String(skipChecks)
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
	static async checkActive (targetUserData: User, channelData: Channel) {
		const list = Reminder.data.get(targetUserData.ID);
		if (!list || list.length === 0) {
			return;
		}

		const excludedUserIDs = Filter.getReminderPreventions({
			platform: channelData?.Platform ?? null,
			channel: channelData
		});

		const now = SupiDate.now();
		const reminders = list.filter(i => (
			!i.deactivated
			&& ((i.Type === "Deferred" && i.Schedule && i.Schedule.valueOf() <= now) || (i.Type !== "Deferred" && !i.Schedule))
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
		const platformData = channelData.Platform;
		if (!platformData) {
			// @todo Remove check after Channel has well-known Platform
			throw new SupiError({
				message: "Missing platform'"
			});
		}

		for (const reminder of reminders) {
			const fromUserData = (reminder.User_From)
				? await User.get(reminder.User_From)
				: null;

			if (reminder.Type === "Pingme") {
				if (!reminder.User_From) {
					throw new SupiError({
						message: "Missing User_From property in Pingme reminder"
					});
				}

				const fromUserData = await User.get(reminder.User_From, false);
				if (!fromUserData) {
					throw new SupiError({
						message: "Invalid User_From value in Pingme reminder"
					});
				}

				const isChannelStalkOptedOut = await channelData.getDataProperty("stalkPrevention");
				const channelStringName = (isChannelStalkOptedOut === true)
					? "[EXPUNGED]"
					: channelData.getFullName();

				let reminderPlatform: Platform | null = null;
				if (reminder.Channel) {
					const channelData = Channel.get(reminder.Channel);
					if (!channelData) {
						throw new SupiError({
							message: "Invalid Channel in Reminder"
						});
					}

					reminderPlatform = channelData.Platform;
				}
				else {
					reminderPlatform = Platform.get(reminder.Platform);
				}

				if (!reminderPlatform) {
					throw new SupiError({
						message: "Unknown Platform in Reminder"
					});
				}

				const uncheckedAuthorMention = await reminderPlatform.createUserMention(fromUserData);
				const authorBanphraseCheck = await sb.Banphrase.execute(uncheckedAuthorMention, channelData);
				const authorMention = (authorBanphraseCheck.passed) ? `${uncheckedAuthorMention}` : "[Banphrased username]";

				const targetMention = await reminderPlatform.createUserMention(targetUserData);
				let message = `${authorMention}, ${targetMention} just typed in channel ${channelStringName}`;

				if (reminder.Text) {
					message += `: ${reminder.Text}`;
				}

				if (reminder.Private_Message) {
					await reminderPlatform.pm(message, fromUserData);
				}
				else if (reminder.Channel) {
					const channelData = Channel.get(reminder.Channel);
					if (!channelData) {
						throw new SupiError({
							message: "Invalid Channel in Reminder"
						});
					}

					const banphraseResult = await sb.Banphrase.execute(message, channelData);
					if (!banphraseResult.passed) {
						await channelData.send(sb.Utils.tag.trim `
							${authorMention},
							a user you set up a "pingme" reminder for has typed somewhere, but I can't post it here.
							I have whispered you the result instead.
						`);

						await reminderPlatform.pm(message, fromUserData.Name, channelData);
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

				// `Pingme` reminders do not follow the regular reminder logic, so continue to next iteration.
				continue;
			}

			if (reminder.Text === null) {
				throw new SupiError({
					message: "Missing Text property in non-Pingme reminder"
				});
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
			else {
				const mention = await platformData.createUserMention(fromUserData);
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

		const targetUserMention = await platformData.createUserMention(targetUserData);
		const targetUserCheck = await sb.Banphrase.execute(targetUserMention, channelData);
		const userMention = (targetUserCheck.passed) ? `${targetUserMention},` : "[Banphrased username],";

		// Handle non-private reminders
		if (reply.length !== 0) {
			let message = `reminder(s) from: ${reply.join("; ")}`;
			if (!channelData.Links_Allowed) {
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

				const limit = channelData.Message_Limit ?? platformData.Message_Limit;

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
				await platformData.pm(`Private reminder: ${privateReminder}`, targetUserData, channelData);
			}

			const publicMessage = `Hey ${userMention} - I just private messaged you ${privateReply.length} private reminder(s) - make sure to check them out!`;
			const publicMirrorMessage = `Hey ${targetUserData.Name} - I just private messaged you ${privateReply.length} private reminder(s) - make sure to check them out!`;

			await Promise.all([
				channelData.send(publicMessage),
				channelData.mirror(publicMirrorMessage, null, { commandUsed: false })
			]);
		}

		// Properly deactivate all reminders here - after all work has been done.
		const deactivatePromises = reminders.map(reminder => reminder.deactivate(true, false));
		await Promise.all(deactivatePromises);

		if (sb.Metrics) {
			Reminder.#activeGauge.set(Reminder.available.size);
			Reminder.#userGauge.set(Reminder.data.size);
		}
	}

	/**
	 * Checks whether it is possible to set up a reminder for given user, respecting limits.
	 * Used mostly in commands to set up reminders.
	 */
	static async checkLimits (userFrom: User["ID"], userTo: User["ID"], schedule: Reminder["Schedule"], type: Type = "Reminder"): Promise<LimitCheckResult> {
		type Item = { Private_Message: Reminder["Private_Message"]; };
		const [incomingData, outgoingData] = await Promise.all([
			sb.Query.getRecordset<Item[]>(rs => rs
				.select("Private_Message")
				.from("chat_data", "Reminder")
				.where("(Type = %s AND Schedule IS NULL) OR (Type = %s AND Schedule IS NOT NULL)", "Reminder", "Deferred")
				.where("User_To = %n", userTo)
			),
			sb.Query.getRecordset<Item[]>(rs => rs
				.select("Private_Message")
				.from("chat_data", "Reminder")
				.where("Schedule IS NULL")
				.where("(Type = %s AND Schedule IS NULL) OR (Type = %s AND Schedule IS NOT NULL)", "Reminder", "Deferred")
				.where("User_From = %n", userFrom)
			)
		]);

		const incomingLimit = config.values.maxIncomingActiveReminders;
		const outgoingLimit = config.values.maxOutgoingActiveReminders;
		const [privateIncoming, publicIncoming] = sb.Utils.splitByCondition(incomingData, (i: Item) => i.Private_Message);
		const [privateOutgoing, publicOutgoing] = sb.Utils.splitByCondition(outgoingData, (i: Item) => i.Private_Message);

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

			const [scheduledIncoming, scheduledOutgoing] = await Promise.all([
				sb.Query.getRecordset<number>(rs => rs
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
				sb.Query.getRecordset<number>(rs => rs
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
			const existingPingmeReminderID = await sb.Query.getRecordset<number | undefined>(rs => rs
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

	static async createRelayLink (endpoint: string, params: string) {
		type RelayResponse = { data: { link: string; }; };
		const relay = await sb.Got.get("Supinic")<RelayResponse>({
			method: "POST",
			url: "relay",
			throwHttpErrors: false,
			json: {
				url: `/bot/reminder/${endpoint}?${params}`
			}
		});

		let link: string;
		if (relay.statusCode === 200) {
			link = relay.body.data.link;
		}
		else {
			console.warn("Relay creation failed", { relay, params });
			link = `https://supinic.com/bot/reminder/${endpoint}?${params}`;
		}

		return link;
	}

	static #add (reminder: Reminder) {
		if (!Reminder.data.has(reminder.User_To)) {
			Reminder.data.set(reminder.User_To, []);
		}

		Reminder.available.set(reminder.ID, reminder.User_To);

		const array = Reminder.data.get(reminder.User_To) as Reminder[]; // Type cast due to condition above
		array.push(reminder);

		reminder.activateTimeout();
	}

	/**
	 * @private
	 * @param [options.cancelled] If `true`, the reminder will be flagged as "Cancelled"
	 * @param [options.permanent] If `true`, the reminder will also be removed/deactivated in the database as well
	 * @returns Whether the changes were applied
	 */
	static async #remove (ID: Reminder["ID"], options: { cancelled?: boolean; permanent?: boolean; } = {}) {
		const { cancelled, permanent } = options;
		if (permanent) {
			const row = await sb.Query.getRow<ConstructorData>("chat_data", "Reminder");
			await row.load(ID, true);

			if (row.loaded) {
				const historyRow = await sb.Query.getRow<HistoryConstructorData>("chat_data", "Reminder_History");

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

		const targetUserID = Reminder.available.get(ID);
		if (!targetUserID) {
			return false;
		}

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
}

export default Reminder;
