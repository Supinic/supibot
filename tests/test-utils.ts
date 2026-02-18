import * as assert from "node:assert/strict";
import { Utils } from "supi-core";
import { Channel } from "../classes/channel.js";
import { Command, type CommandDefinition } from "../classes/command.js";
import { User } from "../classes/user.js";
import { type BaseConfig, type Platform } from "../platforms/template.js";
import { TwitchPlatform } from "../platforms/twitch.js";
import { typedEntries } from "../utils/ts-helpers.js";

export const createTestUser = (opts: { Name?: string, ID?: number, Twitch_ID?: string, Discord_ID?: string } = {}) => new User({
	ID: opts.ID ?? 1,
	Name: opts.Name ?? "sample_user",
	Discord_ID: opts.Discord_ID ?? null,
	Twitch_ID: opts.Twitch_ID ?? null,
	Started_Using: null
});

export const createTestPlatform = (opts: Partial<BaseConfig> = {}) => new TwitchPlatform({
	ID: 1,
	selfId: "123",
	logging: {},
	platform: {},
	messageLimit: opts.messageLimit ?? 500,
	selfName: "Foo",
	active: true
});

export const createTestChannel = (id: number, platform: Platform) => new Channel({
	ID: id,
	Name: `test-channel-${id}`,
	Mode: "Write",
	Specific_ID: null,
	Description: null,
	Banphrase_API_URL: null,
	Banphrase_API_Downtime: null,
	Banphrase_API_Type: null,
	Message_Limit: null,
	Links_Allowed: true,
	Logging: [],
	Mention: true,
	Mirror: null,
	NSFW: false,
	Platform: platform.ID
});

export const createTestCommand = (opts: Partial<CommandDefinition> = {}) => new Command({
	Name: opts.Name ?? "TEST_COMMAND",
	Aliases: opts.Aliases ?? [],
	Code: opts.Code ?? (() => ({ reply: null })),
	Params: opts.Params ?? [],
	Description: null,
	Cooldown: 0,
	Flags: [],
	Whitelist_Response: null,
	Dynamic_Description: () => []
});

type CommandResult = Awaited<ReturnType<Command["execute"]>>;
export const expectCommandResultSuccess = (result: CommandResult, ...includedMessages: string[]) => {
	assert.notStrictEqual(result.success, false, `Expected command success: ${JSON.stringify(result)});`);
	for (const includedMessage of includedMessages) {
		assert.strictEqual(result.reply?.includes(includedMessage), true, `Message does not contain "${includedMessage}"\n\nMessage: ${result.reply}`);
	}

	return result;
};

export const expectCommandResultFailure = (result: CommandResult, ...includedMessages: string[]) => {
	assert.strictEqual(result.success, false, `Expected command failure: ${JSON.stringify(result)});`);
	for (const includedMessage of includedMessages) {
		assert.strictEqual(result.reply?.includes(includedMessage), true, `Message does not contain "${includedMessage}"\n\nMessage: ${result.reply}`);
	}

	return result;
};

export class FakeRecordDeleter {
	public schema: string | null = null;
	public table: string | null = null;
	public conditions: { condition: string, args: unknown[] }[] = [];

	delete (): this {
		return this;
	}

	from (schema: string, object: string): this {
		this.schema = schema;
		this.table = object;
		return this;
	}

	where (condition: string, ...args: unknown[]): this {
		this.conditions.push({ condition, args });
		return this;
	}
}

export class FakeRecordset {
	private schema: string | null = null;
	private table: string | null = null;
	private fields: string[] = [];
	private conditions: { condition: string, args: unknown[] }[] = [];
	private amount: number | null = null;
	private isSingle: boolean = false;
	private flatField: string | null = null;

	select (...args: string[]) {
		this.fields.push(...args);
		return this;
	}

	from (schema: string, object: string) {
		this.schema = schema;
		this.table = object;
		return this;
	}

	where (condition: string, ...args: unknown[]) {
		this.conditions.push({ condition, args });
		return this;
	}

	limit (limit: number) {
		this.amount = limit;
		return this;
	}

	single () {
		this.isSingle = true;
		return this;
	}

	flat (field: string) {
		this.flatField = field;
		return this;
	}
}

type RowKey = string | number;
export class FakeRow {
	private readonly world: TestWorld;

	values: Record<string, unknown> = {};
	stored: boolean = false;
	loaded: boolean = false;
	deleted: boolean = false;
	readonly schema: string;
	readonly table: string;

	constructor (world: TestWorld, schema: string, table: string) {
		this.world = world;
		this.schema = schema;
		this.table = table;
	}

	setValues (values: Record<string, unknown>) {
		this.values = values;
	}

	save () {
		this.stored = true;
	}

	load (key: RowKey) {
		this.loaded = true;

		const tableKey = TestWorld.getKey(this.schema, this.table);
		const worldRowsData = this.world.tablesData.get(tableKey);
		if (worldRowsData) {
			const rowData = worldRowsData.get(key);
			if (rowData) {
				this.setValues(rowData);
			}
		}
	}

	delete () {
		this.deleted = true;
	}

	get updated () {
		return (this.loaded && this.stored);
	}
}

export class TestWorld {
	public readonly rows: FakeRow[] = [];
	public readonly recordsets: FakeRecordset[] = [];
	public readonly recordDeleters: FakeRecordDeleter[] = [];
	public readonly tablesData = new Map<string, Map<RowKey, Record<string, unknown>>>();

	private readonly specificUserIds = new Map<string, number>();
	private readonly allowedUsers = new Set<string>();
	private readonly recordsetQueue: unknown[] = [];

	private readonly users = new Map<string, User>();

	public failOnEmptyRecordset: boolean = true;

	install () {
		// eslint-disable-next-line @typescript-eslint/no-this-alias, unicorn/no-this-assignment
		const world = this;
		const baseCore = {
			Utils: new Utils(),
			Metrics: {
				get: () => ({
					inc: () => {}
				})
			},
			Query: {
				getRecordset () {
					if (world.recordsetQueue.length === 0) {
						if (world.failOnEmptyRecordset) {
							throw new Error("TestWorld.getRecordset - no queued data found");
						}

						return;
					}

					const data = world.recordsetQueue.shift();
					const rs = new FakeRecordset();
					world.recordsets.push(rs);
					return data;
				},

				getRecordDeleter (callback: (rd: FakeRecordDeleter) => FakeRecordDeleter) {
					const rd = new FakeRecordDeleter();
					callback(rd);
					world.recordDeleters.push(rd);
				},

				getRow (schema: string, table: string) {
					const row = new FakeRow(world, schema, table);
					world.rows.push(row);

					const key = `${schema}.${table}`;
					if (!world.tablesData.has(key)) {
						world.tablesData.set(key, new Map());
					}

					return row;
				}
			}
		};

		const baseSb = {
			User: {
				get: (name: string) => {
					const preparedUser = this.users.get(name);
					if (preparedUser) {
						return preparedUser;
					}

					const isAllowed = (this.allowedUsers.has(name));
					if (!isAllowed) {
						return null;
					}

					const ID = this.specificUserIds.get(name);
					return createTestUser({ Name: name, ID });
				},

				getAsserted: (identifier: string | number) => {
					let name: string | undefined;
					let id: number | undefined;
					if (typeof identifier === "string") {
						const isAllowed = (this.allowedUsers.has(identifier));
						if (!isAllowed) {
							throw new Error("Test assert error: User not allowed");
						}

						const potentialId = this.specificUserIds.get(identifier);
						if (!potentialId) {
							throw new Error("Test assert error: User ID does not exist");
						}

						name = identifier;
						id = potentialId;
					}
					else {
						for (const [mapName, mapId] of this.specificUserIds.entries()) {
							if (mapId === identifier) {
								name = mapName;
								id = mapId;
								break;
							}
						}

						if (!name || !id) {
							throw new Error("Test assert error: User ID does not exist");
						}
					}

					return createTestUser({ Name: name, ID: id });
				},

				permissions: User.permissions
			},

			Command: {
				prefix: "$"
			},

			Logger: {
				logCommandExecution: () => {},
				logError: (...args: unknown[]) => { console.log(...args); }
			}
		};

		// @ts-ignore
		globalThis.core = (baseCore as unknown as typeof globalThis.core);
		// @ts-ignore
		globalThis.sb = (baseSb as unknown as typeof globalThis.sb);
	}

	reset () {
		this.rows.length = 0;
		this.recordsets.length = 0;
		this.recordsetQueue.length = 0;

		this.allowedUsers.clear();
		this.specificUserIds.clear();

		this.clearTables();
	}

	queueRsData (data: unknown): void {
		this.recordsetQueue.push(data);
	}

	allowUser (username: string): void {
		this.allowedUsers.add(username);
	}

	prepareUser (userData: User): void {
		this.users.set(userData.Name, userData);
	}

	setUserId (username: string, id: number): void {
		this.specificUserIds.set(username, id);
	}

	setRow (schema: string, table: string, rowId: RowKey, rowData: Record<string, unknown>): void {
		const tableData = this.ensureTable(schema, table);
		tableData.set(rowId, rowData);
	}

	setRows (schema: string, table: string, rows: Record<RowKey, Record<string, unknown>>): void {
		for (const [key, data] of typedEntries(rows)) {
			this.setRow(schema, table, key, data);
		}
	}

	clearTable (schema: string, table: string): void {
		const key = TestWorld.getKey(schema, table);
		this.tablesData.delete(key);
	}

	clearTables (): void {
		this.tablesData.clear();
	}

	private ensureTable (schema: string, table: string) {
		const key = TestWorld.getKey(schema, table);
		let tableData = this.tablesData.get(key);

		if (!tableData) {
			tableData = new Map();
			this.tablesData.set(key, tableData);
		}

		return tableData;
	}

	static getKey (schema: string, table: string) { return `${schema}.${table}`; }
}
