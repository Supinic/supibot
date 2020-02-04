/* global sb */
/**
 * Represents one row of a SQL database table.
 * @type Row
 */
module.exports = class Row {
	/** @type {TableDefinition} */
	#definition = null;
	#primaryKey = null;
	#primaryKeyField = null;
	#values = {};
	#originalValues = {};
	#valueProxy = new Proxy(this.#values, {
		get: (target, name) => {
			if (typeof target[name] === "undefined") {
				throw new sb.Error({
					message: "Getting value: Column " + name + " does not exist"
				});
			}

			return target[name];
		},
		set: (target, name, value) => {
			if (typeof target[name] === "undefined") {
				throw new sb.Error({
					message: "Setting value: Column " + name + " does not exist"
				});
			}

			target[name] = value;
			return true;
		}
	});
	#loaded = false;

	/**
	 * Creates a new Row instance
	 * @param {Query} query
	 * @param {string} database
	 * @param {string} table
	 * @returns {Promise<Row>}
	 */
	constructor (query, database, table) {
		if (!database || !table) {
			throw new sb.Error({
				message: "Row: database and table must be provided",
				args: {
					db: database,
					table: table
				}
			});
		}

		/** @type {Query} */
		this.query = query;

		return (async () => {
			this.#definition = await this.query.getDefinition(database, table);
			for (const column of this.#definition.columns) {
				this.#values[column.name] = Symbol.for("unset");
				this.#originalValues[column.name] = Symbol.for("unset");

				if (column.primaryKey) {
					this.#primaryKeyField = column;
				}
			}

			return this;
		})();
	}

	/**
	 * Loads a row based on its primary key.
	 * @param {number} primaryKey
	 * @param {boolean} ignoreError
	 * @returns {Promise<Row>}
	 */
	async load (primaryKey, ignoreError) {
		if (typeof primaryKey === "undefined") {
			throw new sb.Error({
				message: "Primary key must be passed to Row.load"
			});
		}

		if (this.#primaryKey && this.#primaryKey !== primaryKey) {
			this.reset();
		}
		this.#primaryKey = primaryKey;

		const data = await this.query.raw([
			"SELECT * FROM " + this.#definition.escapedPath,
			"WHERE " + this.query.escapeIdentifier(this.fieldPK.name) + " = " + this.escapedPK
		].join(" "));

		if (!data[0]) {
			if (ignoreError) {
				this.#values[this.fieldPK.name] = primaryKey;
				return this;
			}
			else {
				throw new sb.Error({
					message: "Row load failed - no such PK",
					args: {
						primaryKeyField: this.fieldPK,
						primaryKey: this.PK,
						table: this.path
					}
				});
			}
		}

		for (const column of this.#definition.columns) {
			const value = this.query.convertToJS(data[0][column.name], column.type);
			this.#values[column.name] = value;
			this.#originalValues[column.name] = value;
		}

		this.#loaded = true;
		return this;
	}

	/**
	 * Saves the row.
	 * If a primary key is present, saves the row as new (INSERT).
	 * If not, saves an existing row (UPDATE).
	 * @param {Object} options
	 * @param {boolean} [options.ignore] If true, INSERT will be executed as INSERT IGNORE (ignores duplicate keys)
	 * @returns {Promise<Object>}
	 */
	async save (options = {}) {
		let outputData = null;

		if (this.PK !== null && this.#loaded) { // UPDATE
			let setColumns = [];
			for (const column of this.#definition.columns) {
				if (this.#originalValues[column.name] === this.#values[column.name]) continue;

				setColumns.push(
					this.query.escapeIdentifier(column.name) +
					" = " +
					this.query.convertToSQL(this.#values[column.name], column.type)
				);
			}

			if (setColumns.length === 0) { // no update necessary
				return false;
			}

			outputData = await this.query.raw([
				"UPDATE " + this.path,
				"SET " + setColumns.join(", "),
				"WHERE " + this.query.escapeIdentifier(this.fieldPK.name) + " = " + this.escapedPK
			].join(" "));
		}
		else { // INSERT
			let columns = [];
			let values = [];
			for (const column of this.#definition.columns) {
				if (this.#values[column.name] === Symbol.for("unset")) continue;

				columns.push(this.query.escapeIdentifier(column.name));
				values.push(this.query.convertToSQL(this.#values[column.name], column.type));
			}

			const ignore = (options.ignore === true ? "IGNORE " : "");
			outputData = await this.query.send([
				"INSERT " + ignore + "INTO " + this.path,
				"(" + columns.join(",") + ")",
				"VALUES (" + values.join(",") + ")"
			].join(" "));

			if (outputData.insertId !== 0) {
				this.#primaryKey = outputData.insertId;
				await this.load(this.#primaryKey);
			}
			else if (columns.indexOf(this.fieldPK.name) !== -1) {
				this.#primaryKey = this.#values[this.fieldPK.name];
				await this.load(this.#primaryKey);
			}
			else {
				this.#primaryKey = null;
			}
		}

		return outputData;
	}

	/**
	 * Performs a DELETE operation on the currently loaded row.
	 * @returns {Promise<void>}
	 */
	async delete () {
		if (this.PK !== null) {
			await this.query.send([
				"DELETE FROM " + this.path,
				"WHERE " + this.query.escapeIdentifier(this.fieldPK.name) + " = " + this.escapedPK
			].join(" "));
			this.#loaded = false;
		}
		else {
			throw new sb.Error({
				message: "In order to delete the row, it must be loaded.",
				args: this.fullTable
			});
		}
	}

	/**
	 * @private
	 * Resets the data of the currently loaded row.
	 */
	reset () {
		this.#loaded = false;
		this.#primaryKey = null;
		for (const column of this.#definition.columns) {
			this.#values[column.name] = Symbol.for("unset");
			this.#originalValues[column.name] = Symbol.for("unset");
		}
	}

	/**
	 * Syntax sugar to set multiple values at once.
	 * @param {Object} data
	 * @returns {Row}
	 */
	setValues (data) {
		for (const [key, value] of Object.entries(data)) {
			this.values[key] = value;
		}

		return this;
	}

	/** @type {Object} */
	get valuesObject () { return Object.assign({}, this.#values); }
	get originalValues () { return this.#originalValues; }
	get PK () { return this.#primaryKey; }
	get fieldPK () { return this.#primaryKeyField; }
	get escapedPK () {
		if (this.PK === null) {
			throw new sb.Error({
				message: "Row has no PK"
			});
		}
		return this.query.convertToSQL(this.PK, this.fieldPK.type);
	}
	get values () { return this.#valueProxy; }
	get definition () { return this.#definition || null; }
	get path () {
		if (this.#definition) {
			return this.#definition.path;
		}
		else {
			throw new sb.Error({
				message: "This row has no definition, yet"
			});
		}
	}
	get loaded () { return this.#loaded; }
};