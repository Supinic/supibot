import { SupiDate, SupiError, type Batch } from "supi-core";
import { CronJob } from "cron";
import { getConfig } from "../config.js";
import { typedEntries } from "../utils/ts-helpers.js";

import type { Command } from "../classes/command.js";
import type { User } from "../classes/user.js";
import type { Channel } from "../classes/channel.js";
import type { Platform } from "../platforms/template.js";
import type { JSONifiable } from "../utils/globals.js";

const { logging } = getConfig();
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
	Channel: Channel["ID"] | null;
	Success: boolean;
	Invocation: string;
	Arguments: string | null;
	Result: string | null;
	Execution_Time: number | null;
};
type ErrorType = "Backend" | "Command" | "Database" | "Website" | "Website - API" | "Other" | "Request";

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

/**
 * Logging module that handles all possible chat message and video logging.
 * Accesses the database so that nothing needs to be exposed in chat clients.
 */
export class LoggerSingleton {
	private lastSeenUserMap = new Map<User["ID"], number>();

	private batches = new Set<Batch>();
	private crons: CronJob[] = [];
	private started = false;

	private readonly loggedChannels = new Set<string>();
	private readonly loggedPlatforms = new Set<string>();
	private readonly messageBatches: Record<string, Batch> = {};
	private readonly presentTables = new Set<string>();

	private messageCron?: CronJob;

	private commandBatch?: Batch;
	private commandCron?: CronJob;
	private readonly commandCollector = new Set<number>();

	private readonly lastSeen = new Map<Channel["ID"], Map<User["ID"], { message: string; count: number; date: SupiDate; }>>();
	private lastSeenRunning = false;
	private lastSeenCron?: CronJob;

	public async start (): Promise<void> {
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

			this.messageCron = new CronJob(messages.cron, () => this.storeMessages());

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

			this.commandBatch = batch;
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

	private storeMessages () {
		if (!this.started) {
			return;
		}

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

				console.warn(
					`Channel ${channelData.Name} (${channelData.ID}) exceeded logging limit: ${length}/${loggingWarnLimit}`
				);

				batch.clear();
				continue;
			}

			setTimeout(() => void batch.insert(), i * 250);
			i++;
		}
	}

	private async storeCommands (batch: Batch) {
		if (!this.started || !batch.ready) {
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
		if (!this.started) {
			return;
		}

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
	public async logError (type: ErrorType, error: Error | SupiError, data: {
		origin?: "Internal" | "External";
		context?: unknown;
		arguments?: JSONifiable
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
	 * Pushes a message to a specified channel/platform's queue.
	 * Queues are emptied accordingly to cron-jobs.
	 */
	public async push (message: string, userData: User, channelData: Channel | null, platformData?: Platform): Promise<void> {
		if (this.presentTables.size === 0) {
			return;
		}

		if (channelData) {
			if (!channelData.Logging.has("Lines")) {
				if (channelData.Logging.has("Meta")) {
					this.updateLastSeen({ channelData, message, userData });
				}

				return;
			}

			const chan = `channel-${channelData.ID}`;
			if (!this.loggedChannels.has(chan)) {
				const name = channelData.getDatabaseName();

				if (!this.presentTables.has(name)) {
					await channelData.setupLoggingTable();
				}

				const columns = ["Text", "Posted", "Platform_ID"];
				const hasHistoric = await core.Query.isTableColumnPresent("chat_line", name, "Historic");
				if (hasHistoric) {
					columns.push("Historic"); // Semi-backwards compatibility, should not occur in new bot forks
				}

				this.messageBatches[chan] = await core.Query.getBatch("chat_line", name, columns);
				this.loggedChannels.add(chan);
			}

			const batch = this.messageBatches[chan];
			const hasHistoric = batch.columns.some(i => i.name === "Historic");

			let platformId;
			let historic;
			try {
				platformId = channelData.Platform.fetchInternalPlatformIDByUsername(userData);
				if (hasHistoric) {
					historic = false;
				}
			}
			catch {
				platformId = userData.Name;
				if (hasHistoric) {
					historic = true;
				}
			}

			batch.add({
				Text: message,
				Posted: new SupiDate(),
				Platform_ID: platformId,
				...((typeof historic === "boolean") ? { Historic: historic } : {})
			});
		}
		else if (platformData) {
			const id = `platform-${platformData.ID}`;

			if (!this.loggedPlatforms.has(id)) {
				const name = platformData.privateMessageLoggingTableName;
				if (!this.presentTables.has(name)) {
					await platformData.setupLoggingTable();
				}

				this.messageBatches[id] = await core.Query.getBatch("chat_line", name, ["Text", "Posted", "Platform_ID"]);
				this.loggedPlatforms.add(id);
			}

			let platformId;
			try {
				platformId = platformData.fetchInternalPlatformIDByUsername(userData);
			}
			catch {
				platformId = userData.Name;
			}

			const batch = this.messageBatches[id];
			batch.add({
				Text: message,
				Posted: new SupiDate(),
				Platform_ID: platformId
			});
		}
	}

	/**
	 * Logs a command execution.
	 */
	public logCommandExecution (options: CommandExecutionOptions): void {
		if (!this.commandBatch) {
			return;
		}

		const timestamp = options.Executed.valueOf();
		if (this.commandCollector.has(timestamp)) {
			return;
		}

		this.commandCollector.add(timestamp);
		this.commandBatch.add(options);
	}

	/**
	 * Updates the last-seen metadata for a given user.
	 */
	public updateLastSeen (options: { channelData: Channel, userData: User, message: string }): void {
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

	/**
	 * Fetches the given user's last-seen timestamp, if available.
	 */
	public getUserLastSeen (userId: User["ID"]): SupiDate | null {
		const result = this.lastSeenUserMap.get(userId);
		return (result) ? new SupiDate(result) : null;
	}

	/**
	 * Cleans up and destroys the logger instance
	 */
	public destroy (): void {
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

export const logger = new LoggerSingleton();
