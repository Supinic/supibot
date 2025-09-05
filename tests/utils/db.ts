// @ts-nocheck
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

globalThis.core = {
	Query: {
		getRow: (database, table) => console.log({ database, table })
	}
};
