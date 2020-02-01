/* global sb */
/**
 * Represents the UPDATE sql statement.
 */
module.exports = class RecordUpdater {
	#query = null;
	#update = { database: null, table: null };
	#set = [];
	#where = [];

	/**
	 * Creates a new Recordset instance.
	 * @param {Query} query
	 * @name {Recordset}
	 */
	constructor (query) {
		/** @type {Query} */
		this.#query = query;
	}

	/**
	 * Sets the UPDATE database + table.
	 * @param {string} database
	 * @param {string} table
	 * @returns {RecordUpdater}
	 */
	update (database, table) {
		this.#update.database = database;
		this.#update.table = table;
		return this;
	}

	/**
	 * Sets the SET statement for a specific column.
	 * @param {string} column
	 * @param {*} value
	 * @returns {RecordUpdater}
	 */
	set (column, value) {
		this.#set = this.#set.concat({ column, value });
		return this;
	}

	/**
	 * Sets a WHERE condition.
	 * First parameter can be an option argument {@link WhereHavingParams}
	 * Multiple formatting symbols {@link FormatSymbol} can be used
	 * @param {Array.<string|FormatSymbol|WhereHavingParams>} args
	 * @returns {RecordUpdater}
	 */
	where (...args) {
		let options = {};
		if (args[0] && args[0].constructor === Object) {
			options = args[0];
			args.shift();
		}

		if (typeof options.condition !== "undefined" && !options.condition) {
			return this;
		}

		let format = "";
		if (typeof args[0] === "string") {
			format = args.shift();
		}

		let index = 0;
		format = format.replace(this.#query.formatSymbolRegex, (fullMatch, param) => (
			this.#query.parseFormatSymbol(param, args[index++])
		));

		this.#where = this.#where.concat(format);

		return this;
	}

	/**
	 * Translates the RecordUpdater to its SQL representation.
	 * @returns {Promise<string[]>}
	 * @throws {sb.Error} If no UPDATE database/table have been provided.
	 * @throws {sb.Error} If no SET columns have been provided.
	 */
	async toSQL () {
		if (!this.#update.database || !this.#update.table) {
			throw new sb.Error({
				message: "No UPDATE database/table in RecordUpdater - invalid definition"
			});
		}
		else if (this.#set.length === 0) {
			throw new sb.Error({
				message: "No SET in RecordUpdater - invalid definition"
			});
		}

		const sql = [];
		const set = [];
		const { columns } = await this.#query.getDefinition(this.#update.database, this.#update.table);

		sql.push("UPDATE `" + this.#update.database + "`.`" + this.#update.table + "`");

		for (const { column, value } of this.#set) {
			const definition = columns.find(i => i.name === column);
			if (!definition) {
				throw new sb.Error({
					message: `Unrecognized column "${column}"`
				});
			}

			set.push(`${column} = ${this.#query.convertToSQL(value, definition.type)}`);
		}

		sql.push("SET " + set.join(", "));
		(this.#where.length !== 0) && sql.push("WHERE (" + this.#where.join(") AND (") + ")");

		return sql;
	}

	/**
	 * Runs the UPDATE SQL query and returns the status object.
	 * @returns {Object}
	 */
	async fetch () {
		const sql = await this.toSQL();
		return await this.#query.raw(...sql);
	}
};