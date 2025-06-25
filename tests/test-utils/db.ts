// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { Query } from "supi-core";

class MemoryStore {
	private tables = new Map<string, { nextId: number; rows: unknown[] }>();

	private ensure (table: string) {
		if (!this.tables.has(table)) {
			this.tables.set(table, { nextId: 1, rows: [] });
		}

		return this.tables.get(table);
	}

	insert (table: string, data: Record<string, unknown>) {
		const t = this.ensure(table);
		const id = t.nextId++;
		t.rows.push({ id, ...data });
		return id;
	}

	select (table: string, where?: (r: unknown) => boolean) {
		return this.ensure(table).rows.filter(where ?? (() => true));
	}

	update (table: string, where: (r: unknown) => boolean, changes: Record<string, unknown>) {
		let count = 0;
		for (const row of this.ensure(table).rows) {
			if (where(row)) {
				Object.assign(row, changes);
				count++;
			}
		}
		return count;
	}

	delete (table: string, where: (r: unknown) => boolean) {
		const t = this.ensure(table);
		const before = t.rows.length;
		t.rows = t.rows.filter(r => !where(r));
		return before - t.rows.length;
	}
}

console.log("Injected!", { MemoryStore });

const store = new MemoryStore();
(Query as unknown as any).transactionQuery = async function (sql: string) {
	const normalized = sql.trim().replaceAll(/\s+/g, " ").toUpperCase();

	// INSERT
	let m = normalized.match(/^INSERT INTO\s+([^\s(]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
	if (m) {
		const table = m[1];
		const cols = m[2].split(/\s*,\s*/);
		const data: Record<string, any> = {};
		for (const [i, c] of cols.entries()) {
			(data[c] = params[i]);
		}

		const insertId = store.insert(table, data);
		return { insertId, affectedRows: 1 };
	}

	// SELECT
	if (normalized.startsWith("SELECT")) {
		m = normalized.match(/FROM\s+([^\s]+)(?:\s+WHERE\s+(.+))?/i);
		if (m) {
			const table = m[1];
			const whereClause = m[2];
			let rows = store.select(table);
			if (whereClause && params.length) {
				// only support “ID = ?” for now
				rows = rows.filter(r => r.id === params[0]);
			}
			return rows;
		}
	}

	// UPDATE
	if (normalized.startsWith("UPDATE")) {
		m = normalized.match(/^UPDATE\s+([^\s]+)\s+SET\s+([^ ]+)=\?\s+WHERE\s+(.+)=\?/i);
		if (m) {
			const [_, table, col, whereCol] = m;
			const [newVal, whereVal] = params;
			const count = store.update(table, r => r[whereCol] === whereVal, { [col]: newVal });
			return { affectedRows: count };
		}
	}

	// DELETE
	if (normalized.startsWith("DELETE")) {
		m = normalized.match(/^DELETE FROM\s+([^\s]+)\s+WHERE\s+(.+)=\?/i);
		if (m) {
			const [_, table, whereCol] = m;
			const count = store.delete(table, r => r[whereCol] === params[0]);
			return { affectedRows: count };
		}
	}

	throw new Error(`Unmocked SQL: ${sql}`);
};
