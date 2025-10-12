import { DatabaseSync, type SupportedValueType } from "node:sqlite";
import assert from "node:assert/strict";

import { Utils } from "supi-core";
import { Command } from "../classes/command.js";
import { User } from "../classes/user.js";
import { TwitchPlatform } from "../platforms/twitch.js";

const tn = (schema: string, table: string) => `"${schema}__${table}"`;

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
	assert.notStrictEqual(result.success, false, `Expected command success: ${JSON.stringify(result)}`);
	for (const includedMessage of includedMessages) {
		assert.strictEqual(result.reply?.includes(includedMessage), true, `Message does not contain "${includedMessage}"\n\nMessage: ${result.reply}`);
	}

	return result;
};

export const expectCommandResultFailure = (result: CommandResult, ...includedMessages: string[]) => {
	assert.strictEqual(result.success, false, `Expected command failure: ${JSON.stringify(result)}`);
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

type AnyRow = Record<string, SupportedValueType>;
type WhereFrag = { sql: string; params: SupportedValueType[] };

class SqlRecordsetBuilder {
	private _schema: string | null = null;
	private _table: string | null = null;
	private _fields: string[] = [];
	private _wheres: WhereFrag[] = [];
	private _limit: number | null = null;
	private _single = false;
	private _flat: string | null = null;

	select (...fields: string[]) {
		this._fields.push(...fields);
		return this;
	}

	from (schema: string, table: string) {
		this._schema = schema;
		this._table = table;
		return this;
	}

	where (condition: string, ...args: SupportedValueType[]) {
		// Convert %n to '?' for parameter binding
		const sql = condition.replaceAll("%n", "?");
		this._wheres.push({ sql, params: args });
		return this;
	}

	limit (n: number) {
		this._limit = n;
		return this;
	}

	single () {
		this._single = true;
		return this;
	}

	flat (field: string) {
		this._flat = field;
		return this;
	}

	// Internal compiler
	buildSQL () {
		if (!this._schema || !this._table) {
			throw new Error("Recordset.from(schema, table) not specified");
		}

		const select = this._fields.length
			? this._fields.map(i => `"${i}"`).join(",")
			: "*";

		const whereSql = this._wheres.length
			? `WHERE ${this._wheres.map(i => `(${i.sql})`).join(" AND ")}`
			: "";

		const params = this._wheres.flatMap(w => w.params);

		const lim = (this._single && this._limit === null) ? 1 : this._limit;
		const limitSql = (lim !== null) ? ` LIMIT ${lim}` : "";

		const sql = `SELECT ${select} FROM ${tn(this._schema, this._table)} ${whereSql} ORDER BY rowid${limitSql}`;
		return {
			sql,
			params,
			flat: this._flat,
			single: this._single
		};
	}
}

class SqlRow {
	private _values: AnyRow = {};
	private _stored = false;
	private _loaded = false;

	private world: TestWorld;
	public readonly schema: string;
	public readonly table: string;

	constructor (world: TestWorld, schema: string, table: string) {
		this.world = world;
		this.schema = schema;
		this.table = table;
	}

	setValues (values: AnyRow) {
		this._values = { ...values };
	}

	get values () {
		return this._values;
	}

	get stored () {
		return this._stored;
	}

	get loaded () {
		return this._loaded;
	}

	get updated () {
		return this._loaded && this._stored;
	}

	save (opts?: { skipLoad?: boolean }) {
		const db = this.world.db;
		const keys = Object.keys(this._values);
		if (keys.length === 0) {
			return;
		}

		// Upsert by ID if present, else insert
		const hasId = Object.prototype.hasOwnProperty.call(this._values, "ID");
		const tableName = tn(this.schema, this.table);

		db.exec("BEGIN");
		try {
			if (hasId) {
				// Try UPDATE first
				const setCols = keys.filter(k => k !== "ID").map(k => `"${k}" = ?`).join(",");
				const setVals = keys.filter(k => k !== "ID").map(k => this._values[k]);
				const upd = db.prepare(`UPDATE ${tableName} SET ${setCols} WHERE "ID" = ?`);

				const result = upd.run(...setVals, this._values.ID);
				if (result.changes === 0) {
					// Fallback INSERT (explicit ID)
					const cols = keys.map(k => `"${k}"`).join(",");
					const qs = keys.map(() => "?").join(",");
					const statement = db.prepare(`INSERT INTO ${tableName} (${cols}) VALUES (${qs})`);

					statement.run(...keys.map(k => this._values[k]));
				}
			}
			else {
				// Plain INSERT
				const cols = keys.map(k => `"${k}"`).join(",");
				const qs = keys.map(() => "?").join(",");

				const statement = db.prepare(`INSERT INTO ${tableName} (${cols}) VALUES (${qs})`);
				const res = statement.run(...keys.map(k => this._values[k]));
				this.values.ID = Number(res.lastInsertRowid);
			}
			db.exec("COMMIT");
			this._stored = true;
		}
		catch (e) {
			db.exec("ROLLBACK");
			throw e;
		}

		if (!opts?.skipLoad) {
			// Load freshly stored row back (by ID if available)
			const byId = this.values.ID;
			if (byId !== null) {
				const row = db.prepare(`SELECT * FROM ${tableName} WHERE "ID" = ?`).get(byId) as AnyRow | undefined;
				if (row) {
					this._values = row;
				}
			}

			this._loaded = true;
		}
	}

	load () {
		// no-op unless an ID is present
		const byId = this._values.ID;
		if (byId === null) {
			return;
		}

		const row = this.world.db.prepare(`SELECT * FROM ${tn(this.schema, this.table)} WHERE "ID" = ?`).get(byId) as AnyRow | undefined;
		if (row) {
			this._values = row;
			this._loaded = true;
		}
	}
}

export class TestWorld {
	public readonly db: DatabaseSync;

	public readonly rows: FakeRow[] = [];
	public readonly recordsets: FakeRecordset[] = [];
	public readonly tables = new Map<string, unknown[]>();

	private readonly specificUserIds = new Map<string, number>();
	private readonly allowedUsers = new Set<string>();
	private readonly recordsetQueue: unknown[] = [];
	private readonly createdTables: Array<{ schema: string; table: string }> = [];

	public failOnEmptyRecordset: boolean = true;

	constructor (fileDbPath = ":memory:") {
		this.db = new DatabaseSync(fileDbPath);
		this.db.exec(`PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON;`);
	}

	install () {
		// eslint-disable-next-line @typescript-eslint/no-this-alias, unicorn/no-this-assignment
		const world = this;
		const baseCore = {
			Utils: new Utils(),
			Query: {
				getRecordset (builder: (rs: SqlRecordsetBuilder) => SqlRecordsetBuilder) {
					const rs = builder(new SqlRecordsetBuilder());
					const { sql, params, flat, single } = rs.buildSQL();
					const rows = world.db.prepare(sql).all(...params) as AnyRow[];

					// Shape
					let out: unknown;
					if (flat) {
						const list = rows.map(r => r[flat]);
						out = single ? list[0] : list;
					}
					else if (single) {
						out = (rows[0] ?? undefined);
					}
					else {
						out = rows;
					}

					return out;
				},

				getRow (schema: string, table: string) {
					return new SqlRow(world, schema, table);
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

	installSchemas (defs: Array<{ schema: string; table: string; ddl: string }>) {
		this.db.exec("BEGIN");
		try {
			for (const def of defs) {
				this.db.exec(def.ddl.replaceAll("__TABLE__", tn(def.schema, def.table)));
				const key = `${def.schema}.${def.table}`;
				if (!this.createdTables.some(t => `${t.schema}.${t.table}` === key)) {
					this.createdTables.push({ schema: def.schema, table: def.table });
				}
			}

			this.db.exec("COMMIT");
		}
		catch (e) {
			this.db.exec("ROLLBACK");
			throw e;
		}
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

	insertRow (schema: string, table: string, row: unknown): void {
		const tableData = this.ensureTable(schema, table);
		tableData.push(row);
	}

	insertRows (schema: string, table: string, rows: unknown[]): void {
		const tableData = this.ensureTable(schema, table);
		tableData.push(...rows);
	}

	clearTable (schema: string, table: string): void {
		const key = TestWorld.getKey(schema, table);
		this.tables.set(key, []);
	}

	useTable (schema: string, table: string): void {
		const rows = this.ensureTable(schema, table);
		this.queueRsData(rows);
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
