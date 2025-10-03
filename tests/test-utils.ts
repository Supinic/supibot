import { Utils } from "supi-core";
import { Command } from "../classes/command.js";
import { User } from "../classes/user.js";
import { TwitchPlatform } from "../platforms/twitch.js";

import assert from "node:assert/strict";

export const createTestUser = (opts: { Name?: string, ID?: number, } = {}) => new User({
	ID: opts.ID ?? 1,
	Name: opts.Name ?? "sample_user",
	Discord_ID: null,
	Twitch_ID: null,
	Started_Using: null
});

export const createTestPlatform = () => new TwitchPlatform({
	ID: 1,
	selfId: "123",
	logging: {},
	platform: {},
	messageLimit: 500,
	selfName: "Foo",
	active: true
});

export const createTestCommand = (opts: { Name?: string } = {}) => new Command({
	Name: opts.Name ?? "TEST_COMMAND",
	Aliases: [],
	Code: () => ({ reply: null }),
	Description: null,
	Cooldown: null,
	Flags: [],
	Params: [],
	Whitelist_Response: null,
	Dynamic_Description: () => []
});

type CommandResult = Awaited<ReturnType<Command["execute"]>>;
export const expectCommandResultSuccess = (result: CommandResult, ...includedMessages: string[]) => {
	assert.notStrictEqual(result.success, false, "Expected command success");
	for (const includedMessage of includedMessages) {
		assert.strictEqual(result.reply?.includes(includedMessage), true, `Message does not contain "${includedMessage}"\n\nMessage: ${result.reply}`);
	}

	return result;
};

export const expectCommandResultFailure = (result: CommandResult, ...includedMessages: string[]) => {
	assert.strictEqual(result.success, false, "Expected command failure");
	for (const includedMessage of includedMessages) {
		assert.strictEqual(result.reply?.includes(includedMessage), true, `Message does not contain "${includedMessage}"\n\nMessage: ${result.reply}`);
	}

	return result;
};

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

export class FakeRow {
	private readonly world: TestWorld;

	values: Record<string, unknown> = {};
	stored: boolean = false;
	loaded: boolean = false;
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

	load () {
		this.loaded = true;
	}

	get updated () {
		return (this.loaded && this.stored);
	}
}

export class TestWorld {
	public readonly rows: FakeRow[] = [];
	public readonly recordsets: FakeRecordset[] = [];
	public readonly tables = new Map<string, unknown[]>();

	private readonly specificUserIds = new Map<string, number>();
	private readonly allowedUsers = new Set<string>();
	private readonly recordsetQueue: unknown[] = [];

	public failOnEmptyRecordset: boolean = true;

	install () {
		// eslint-disable-next-line @typescript-eslint/no-this-alias, unicorn/no-this-assignment
		const world = this;
		const baseCore = {
			Utils: new Utils(),
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

				getRow (schema: string, table: string) {
					const row = new FakeRow(world, schema, table);
					world.rows.push(row);

					const key = `${schema}.${table}`;
					if (!world.tables.has(key)) {
						world.tables.set(key, []);
					}

					return row;
				}
			}
		};

		const baseSb = {
			User: {
				get: (name: string) => {
					const isAllowed = (this.allowedUsers.has(name));
					if (!isAllowed) {
						return null;
					}

					const ID = this.specificUserIds.get(name);
					return createTestUser({ Name: name, ID });
				}
			}
		};

		globalThis.core = (baseCore as unknown as typeof globalThis.core);
		globalThis.sb = (baseSb as unknown as typeof globalThis.sb);
	}

	reset () {
		this.rows.length = 0;
		this.recordsets.length = 0;
		this.recordsetQueue.length = 0;
		this.allowedUsers.clear();
		this.specificUserIds.clear();
	}

	clearTables () {
		this.tables.clear();
	}

	queueRsData (data: unknown) {
		this.recordsetQueue.push(data);
	}

	allowUser (username: string) {
		this.allowedUsers.add(username);
	}

	setUserId (username: string, id: number) {
		this.specificUserIds.set(username, id);
	}

	insertRows (schema: string, table: string, rows: unknown[]): void {
		const tableData = this.ensureTable(schema, table);
		tableData.push(...rows);
	}

	clearTable (schema: string, table: string): void {
		const key = TestWorld.getKey(schema, table);
		this.tables.set(key, []);
	}

	/**
	 * @todo
	 * Queue the current table snapshot as the next recordset result.
	 * No SQL matching — you can shape the result with simple options.
	 */
	useTable (schema: string, table: string, opts?: { limit?: number; single?: boolean; flat?: string } ): void {
		const rows = this.snapshot(schema, table);

		let out: unknown = rows;

		if (typeof opts?.limit === "number") {
			(out as AnyRow[]).splice(opts.limit); // in-place slice to respect insertion order
		}

		if (opts?.flat) {
			out = (out as AnyRow[]).map(r => (r as AnyRow)[opts.flat!]);
		}

		if (opts?.single) {
			out = (out as AnyRow[])[0] ?? null;
		}

		this.queueRsData(out);
	}


	private ensureTable (schema: string, table: string): unknown[] {
		const key = TestWorld.getKey(schema, table);
		let tableData = this.tables.get(key);

		if (!tableData) {
			tableData = [];
			this.tables.set(key, tableData);
		}

		return tableData;
	}

	static getKey (schema: string, table: string) { return `${schema}.${table}`; }
}
