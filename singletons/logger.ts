import { SupiDate, SupiError, type Batch } from "supi-core";
import { CronJob } from "cron";
import { getConfig } from "../config.js";
import { typedEntries } from "../utils/ts-helpers.js";

import type { Command } from "../classes/command.js";
import type { User } from "../classes/user.js";
import type { Channel } from "../classes/channel.js";
import type { Platform } from "../platforms/template.js";


const { logging } = getConfig();

const notified = {
	lastSeen: false,
	privatePlatformLogging: []
};

const FALLBACK_WARN_LIMIT = 2500;
const loggingWarnLimit = logging.messages.warnLimit ?? FALLBACK_WARN_LIMIT;

type PrimaryTag = "Command" | "Message" | "Twitch" | "Discord" | "Cytube" | "Module" | "System";
type SecondaryTag = "Request" | "Fail" | "Warning" | "Success" | "Shadowban" | "Ban" | "Clearchat" | "Sub" | "Giftsub" | "Host" | "Error" | "Timeout" | "Restart" | "Other" | "Ritual" | "Join";
type Tag = `${PrimaryTag}.${SecondaryTag}`;

type CommandExecutionOptions = {
	Executed: SupiDate;
	User_Alias: User["ID"];
	Command: Command["Name"];
	Platform: Platform["ID"];
	Channel: Channel["ID"];
	Success: boolean;
	Invocation: string;
	Arguments: string[] | null;
	Result: string | null;
	Execution_Time: number;
};

type ChannelCommandMeta = { date: SupiDate; command: string; result: string | null; };
const setMetaChannelCommand = async (channelId: number, meta: ChannelCommandMeta) => {
	const row = await core.Query.getRow("chat_data", "Meta_Channel_Command");
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
};

let logger: LoggerSingleton;

/**
 * Logging module that handles all possible chat message and video logging.
 * Accesses the database so that nothing needs to be exposed in chat clients.
 */
export class LoggerSingleton {
	private lastSeenUserMap = new Map<User["ID"], number>();

	private batches = new Set<Batch>();
	private crons: CronJob[] = [];
	private started = false;

	private readonly channels = [];
	private readonly platforms = [];
	private readonly messageBatches: Record<string, Batch> = {};
	private readonly presentTables = new Set<string>();

	private messageCron?: CronJob;

	private commandBatch?: Batch;
	private readonly commandCollector = new Set<unknown>();
	private commandCron?: CronJob;

	private readonly lastSeen = new Map<Channel["ID"], Map<User["ID"], { message: string; count: number; date: SupiDate; }>>();
	private lastSeenRunning = false;
	private lastSeenCron?: CronJob;

	constructor () {
		if (logger) {
			return logger;
		}
	}

	protected async start () {
		if (this.started) {
			return;
		}

		const { commands, lastSeen, messages } = logging;

		if (messages.enabled && messages.cron) {
			const tables = await core.Query.getRecordset<string[]>(rs => rs
				.select("TABLE_NAME")
				.from("INFORMATION_SCHEMA", "TABLES")
				.where("TABLE_SCHEMA = %s", "chat_line")
				.flat("TABLE_NAME")
			);

			for (const table of tables) {
				this.presentTables.add(table);
			}

			this.messageCron = new CronJob(messages.cron, () => void this.storeMessages());

			this.messageCron.start();
			this.crons.push(this.messageCron);
		}

		if (commands.enabled && commands.cron) {
			const batch = await core.Query.getBatch(
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

			this.commandCron = new CronJob(commands.cron, async () => this.storeCommands(batch));
			this.commandCron.start();

			this.batches.add(batch);
			this.crons.push(this.commandCron);
		}

		if (lastSeen.enabled && lastSeen.cron) {
			this.lastSeenCron = new CronJob(lastSeen.cron, async () => {
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
					await core.Query.pool.batch(
						core.Utils.tag.trim `
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
			this.crons.push(this.lastSeenCron);
		}

		this.started = true;
	}

	private async storeMessages () {
		let i = 0;
		for (const [name, batch] of typedEntries(this.messageBatches)) {
			if (batch.records.length === 0) {
				continue;
			}

			if (batch.records.length > loggingWarnLimit) {
				const length = batch.records.length;
				const channelID = Number(name.split("-")[1]);
				const channelData = sb.Channel.get(channelID);
				if (!channelData) {
					continue;
				}

				await this.log(
					"Message.Warning",
					`Channel "${channelData.Name}" exceeded logging limit ${length}/${loggingWarnLimit}`,
					channelData,
					null
				);

				batch.clear();
				continue;
			}

			setTimeout(() => void batch.insert(), i * 250);
			i++;
		}
	}

	private async storeCommands (batch: Batch) {
		if (!batch.ready) {
			return;
		}

		type ExecutionRecord = {
			User_Alias: User["ID"];
			Command: Command["Name"];
			Platform: Platform["ID"];
			Channel: Channel["ID"];
			Executed: SupiDate;
			Result: string;
		};

		const channelMeta = new Map<number, ChannelCommandMeta>();
		for (const record of batch.records) {
			if (!record.Channel) {
				continue; // Don't meta-log private message commands
			}

			const { Channel: channelId, Executed: date, Command: command, Result: result } = record as ExecutionRecord;
			const existing = channelMeta.get(channelId);
			if (!existing || existing.date < date) {
				channelMeta.set(channelId, { date, command, result });
			}
		}

		const metaPromises = [];
		for (const [channelId, meta] of channelMeta.entries()) {
			const promise = setMetaChannelCommand(channelId, meta);
			metaPromises.push(promise);
		}

		await Promise.all([
			batch.insert({ ignore: true }),
			...metaPromises
		]);

		this.commandCollector.clear();
	}

	/**
	 * Inserts a log message into the database - `chat_data.Log` table
	 */
	public async log (tag: Tag, description: string | null = null, channel: Channel | null = null, user: User | null = null) {
		const [parentTag, childTag = null] = tag.split(".");
		const row = await core.Query.getRow("chat_data", "Log");

		row.setValues({
			Tag: parentTag,
			Subtag: childTag,
			Description: (typeof description === "string") ? description.slice(0, 65000) : description,
			Channel: (channel) ? channel.ID : null,
			User_Alias: (user) ? user.ID : null
		});

		const result = await row.save({ skipLoad: true });
		if (!result || !("insertId" in result)) {
			throw new SupiError({
				message: "Assert error: Row not updated"
			});
		}

		return result.insertId;
	}

	/**
	 * Logs a new error, and returns its ID.
	 */
	public async logError (type: string, error: Error | SupiError, data: {
		origin?: "Internal" | "External";
		context?: object;
		arguments?: string[]
	} = {}): Promise<number> {
		const { message, stack } = error;
		const row = await core.Query.getRow("chat_data", "Error");
		row.setValues({
			Type: type,
			Origin: data.origin ?? null,
			Message: message,
			Stack: stack ?? null,
			Context: (data.context) ? JSON.stringify(data.context) : null,
			Arguments: (data.arguments) ? JSON.stringify(data.arguments) : null
		});

		const result = await row.save({ skipLoad: true });
		if (!result || !("insertId" in result)) {
			throw new SupiError({
				message: "Assert error: No updated columns in Row"
			});
		}

		return Number(result.insertId);
	}

	/**
	 * Pushes a message to a specified channel's queue.
	 * Queues are emptied accordingly to cron-jobs prepared in {@link LoggerSingleton.constructor}
	 * @todo why is channel nullable and platform also nullable lul
	 */
	public async push (message: string, userData: User, channelData: Channel | null, platformData: Platform): Promise<void> {
		if (this.presentTables.size === 0) {
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

				if (!this.presentTables.has(name)) {
					await channelData.setupLoggingTable();
				}

				const [hasUserAlias, hasHistoric, hasPlatformID] = await Promise.all([
					core.Query.isTableColumnPresent("chat_line", name, "User_Alias"),
					core.Query.isTableColumnPresent("chat_line", name, "Historic"),
					core.Query.isTableColumnPresent("chat_line", name, "Platform_ID")
				]);

				const columns = ["Text", "Posted"];
				if (hasUserAlias) {
					columns.push("User_Alias"); // Backwards compatibility, should never occur
				}
				if (hasHistoric) {
					columns.push("Historic"); // Semi-backwards compatibility, should not occur in new bot forks
				}
				if (hasPlatformID) {
					columns.push("Platform_ID"); // Always present
				}

				this.messageBatches[chan] = await core.Query.getBatch("chat_line", name, columns);
				this.channels.push(chan);
			}

			const lineObject = {
				Text: message,
				Posted: new SupiDate()
			};

			const batch = this.messageBatches[chan];
			const hasUserAlias = batch.columns.some(i => i.name === "User_Alias"); // legacy, should not occur anymore
			const hasPlatformID = batch.columns.some(i => i.name === "Platform_ID");
			const hasHistoric = batch.columns.some(i => i.name === "Historic");

			if (hasUserAlias) {
				lineObject.User_Alias = userData.ID;
			}
			if (hasPlatformID) {
				try {
					lineObject.Platform_ID = await channelData.Platform.fetchInternalPlatformIDByUsername(userData);
					if (hasHistoric) {
						lineObject.Historic = false;
					}
				}
				catch {
					lineObject.Platform_ID = userData.Name;
					if (hasHistoric) {
						lineObject.Historic = true;
					}
				}
			}

			try {
				batch.add(lineObject);
			}
			catch (e) {
				console.error("Batch addition error", e);

				const index = this.channels.indexOf(chan);
				this.channels.splice(index, 1);

				batch.clear();
				batch.destroy();
				delete this.messageBatches[chan];
			}
		}
		else if (platformData) {
			const id = `platform-${platformData.ID}`;

			if (!this.platforms.includes(id)) {
				const name = platformData.privateMessageLoggingTableName;
				if (!this.presentTables.has(name)) {
					await platformData.setupLoggingTable();
				}

				this.messageBatches[id] = await core.Query.getBatch("chat_line", name, ["Text", "Posted", "Platform_ID", "Historic"]);
				this.platforms.push(id);
			}

			const lineObject = {
				Text: message,
				Posted: new SupiDate()
			};

			try {
				lineObject.Platform_ID = await platformData.fetchInternalPlatformIDByUsername(userData);
				lineObject.Historic = false;
			}
			catch {
				lineObject.Platform_ID = userData.Name;
				lineObject.Historic = true;
			}

			const batch = this.messageBatches[id];

			batch.add(lineObject);
		}
	}

	/**
	 * Logs a command execution.
	 */
	public logCommandExecution (options: CommandExecutionOptions) {
		if (!this.commandBatch) {
			return;
		}

		if (this.commandCollector.has(options.Executed.valueOf())) {
			return;
		}

		this.commandCollector.add(options.Executed.valueOf());
		this.commandBatch.add(options);
	}

	public updateLastSeen (options: { channelData: Channel, userData: User, message: string }) {
		if (!logging.lastSeen.enabled) {
			return;
		}

		const { channelData, message, userData } = options;
		let map = this.lastSeen.get(channelData.ID);
		if (!map) {
			map = new Map();
			this.lastSeen.set(channelData.ID, map);
		}

		const count = map.get(userData.ID)?.count ?? 0;
		const now = new SupiDate();

		this.lastSeenUserMap.set(userData.ID, now.valueOf());
		map.set(userData.ID, {
			message: message.slice(0, 2000),
			count: count + 1,
			date: now
		});
	}

	public getUserLastSeen (userId: User["ID"]) {
		const result = this.lastSeenUserMap.get(userId);
		return (result) ? new SupiDate(result) : null;
	}

	/**
	 * Cleans up and destroys the logger instance
	 */
	public destroy () {
		for (const cron of this.crons) {
			void cron.stop();
		}

		for (const batch of Object.values(this.messageBatches)) {
			batch.clear();
		}

		for (const batch of this.batches) {
			batch.clear();
		}
		this.batches.clear();
	}
};

logger = new LoggerSingleton();
export logger;
