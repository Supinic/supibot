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
export const expectCommandResultSuccess = (result: CommandResult, includedMessage?: string, message?: string) => {
	assert.notStrictEqual(result.success, false, message ?? "expected success");
	if (includedMessage) {
		assert.strictEqual(result.reply?.includes(includedMessage), true);
	}

	return result;
};

export const expectCommandResultFailure = (result: CommandResult, includedMessage?: string, message?: string) => {
	assert.strictEqual(result.success, false, message ?? "expected failure");
	if (includedMessage) {
		assert.strictEqual(result.reply?.includes(includedMessage), true);
	}

	return result;
};

export class FakeRecordset {
	private object: string | null = null;
	private fields: string[] = [];
	private conditions: unknown[] = [];
	private amount: number | null = null;
	private isSingle: boolean = false;

	select (...args: string[]) {
		this.fields.push(...args);
		return this;
	}

	from (object: string) {
		this.object = object;
		return this;
	}

	where (...args: unknown[]) {
		this.conditions.push(...args);
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
}

export class TestWorld <Tables extends object = object> {
	public readonly rows: FakeRow[] = [];
	public readonly recordsets: FakeRecordset[] = [];
	public readonly tables = new Map<string, Tables[]>();

	private allowedUsers = new Set<string>();
	private recordsetQueue: unknown[] = [];
	public failOnEmptyRecordset = true;

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
				}
			}
		};

		const baseSb = {
			User: {
				get: (name: string) => (this.allowedUsers.has(name))
					? createTestUser({ Name: name })
					: null
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

	static getKey (schema: string, table: string) { return `${schema}.${table}`; }
}
