/* global sb */
/**
 * Represents the result of a SELECT statement with (usually) more than one result row.
 */
module.exports = class Recordset {
	#query = null;
	#fetchSingle = false;
	#raw = null;
	#options = {};

	#select = [];
	#from = { database: null, table: null };
	#where = [];
	#having = [];
	#orderBy = [];
	#groupBy = [];
	#join = [];
	#limit = null;
	#offset = null;
	#reference = null;

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
	 * Sets a flag so the recordset will return the first result directly instead of returning an array.
	 * @returns {Recordset}
	 */
	single () {
		this.#fetchSingle = true;
		return this;
	}

	/**
	 * Sets an option to be used when constructing the SQL query.
	 * @param option
	 */
	use (option) {
		this.#options[option] = value;
	}

	/**
	 * Sets the LIMIT.
	 * @param {number} number
	 * @returns {Recordset}
	 * @throws {sb.Error} If number is not a finite number
	 */
	limit (number) {
		this.#limit = Number(number);

		if (!Number.isFinite(this.#limit)) {
			throw new sb.Error({
				message: "Limit must be a finite number",
				args: number
			});
		}

		return this;
	}

	/**
	 * Sets the OFFSET.
	 * @param {number} number
	 * @returns {Recordset}
	 * @throws {sb.Error} If number is not a finite number
	 */
	offset (number) {
		this.#offset = Number(number);

		if (!Number.isFinite(this.#offset)) {
			throw new sb.Error({
				message: "Offset must be a finite number",
				args: number
			});
		}

		return this;
	}

	/**
	 * Sets SELECT fields.
	 * @param {string[]} args
	 * @returns {Recordset}
	 */
	select (...args) {
		this.#select = this.#select.concat(args);
		return this;
	}

	/**
	 * Sets the FROM table
	 * @param {string} database
	 * @param {string} table
	 * @returns {Recordset}
	 */
	from (database, table) {
		if (!database || !table) {
			throw new sb.Error({
				message: "Recordset: database and table must be provided",
				args: {
					db: database,
					table: table
				}
			});
		}

		this.#from.database = database;
		this.#from.table = table;
		return this;
	}

	/**
	 * Sets a GROUP BY statement.
	 * @param {string[]} args
	 * @returns {Recordset}
	 */
	groupBy (...args) {
		this.#groupBy = this.#groupBy.concat(args);
		return this;
	}

	/**
	 * Sets an ORDER BY statement.
	 * @param {string[]} args
	 * @returns {Recordset}
	 */
	orderBy (...args) {
		this.#orderBy = this.#orderBy.concat(args);
		return this;
	}

	/**
	 * Sets a WHERE condition.
	 * First parameter can be an option argument {@link WhereHavingParams}
	 * Multiple formatting symbols {@link FormatSymbol} can be used
	 * @param {Array.<string|FormatSymbol|WhereHavingParams>} args
	 * @returns {Recordset}
	 */
	where (...args) {
		return this.conditionWrapper("where", ...args);
	}

	/**
	 * Sets a HAVING condition.
	 * First parameter can be an option argument {@link WhereHavingParams}
	 * Multiple formatting symbols {@link FormatSymbol} can be used
	 * @param {Array} args
	 * @returns {Recordset}
	 */
	having (...args) {
		return this.conditionWrapper("having", ...args);
	}

	/**
	 * Sets a HAVING/WHERE condition, avoids duplicate code
	 * @private
	 * @param {"where"|"having"} type
	 * @param {Array} args
	 * @returns {Recordset}
	 */
	conditionWrapper (type, ...args) {
		let options = {};
		if (args[0] && args[0].constructor === Object) {
			options = args[0];
			args.shift();
		}

		if (typeof options.condition !== "undefined" && !options.condition) {
			return this;
		}

		if (typeof options.raw !== "undefined") {
			this.#where.push(options.raw);
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

		if (type === "where") {
			this.#where = this.#where.concat(format);
		}
		else if (type === "having") {
			this.#having = this.#having.concat(format);
		}
		else {
			throw new sb.Error({
				message: "Recordset: Unrecognized condition wrapper option",
				args: arguments
			})
		}

		return this;
	}

	/**
	 * Sets a table to JOIN.
	 * @param {string|Object} target If string, represents the name of the table to join.
	 * @param {string} [target.raw] If target is Object, and raw is specified, parsing is skipped and the string is used directly.
	 * @param {string} database Database of joined table
	 * @param {string} [customField] If set, attempts to join the table via specific field
	 * @param {string} left
	 * @returns {Recordset}
	 */
	join (database, target, customField, left = "") {
		if (typeof target === "string") {
			const dot = (database) ? (database + ".`" + target + "`") : ("`" + target + "`");
			this.#join.push(left + "JOIN " + dot + " ON `" + this.#from.table + "`.`" + (customField || target) + "` = " + dot + ".ID");
		}
		else if (database && database.constructor === Object) {
			const {toDatabase = this.#from.database, toTable, toField, fromTable, fromField, alias, condition, on} = database;
			if (!toTable || !toDatabase) {
				throw new sb.Error({
					message: "Missing compulsory arguments for join",
					args: target
				});
			}

			let result = left + "JOIN `" + toDatabase + "`.`" + toTable + "`";
			if (alias) {
				result += " AS `" + alias + "` ";
			}

			if (on) {
				result += "ON " + on;
			}
			else {
				result += " ON `" + fromTable + "`.`" + fromField + "` = `" + toTable + "`.`" + toField + "`";
				if (condition) {
					result += " AND " + condition;
				}
			}

			this.#join.push(result);
		}
		else if (target && target.constructor === Object) {
			if (typeof target.raw === "string") {
				this.#join.push(left + "JOIN " + target.raw);
			}
		}

		return this;
	}

	/**
	 * Sets a table to LEFT JOIN.
	 * @todo - this needs a better implementation
	 * @param {string|Object} target If string, represents the name of the table to join.
	 * @param {string} [target.raw] If target is Object, and raw is specified, parsing is skipped and the string is used directly.
	 * @param {string} database Database of joined table
	 * @param {string} [customField] If set, attempts to join the table via specific field
	 * @returns {Recordset}
	 */
	leftJoin (database, target, customField) {
		return this.join(database, target, customField, "LEFT ");
	}

	/**
	 *
	 */
	reference (options = {}) {
		const {
			sourceDatabase = this.#from.database,
			sourceTable = this.#from.table,
			sourceField = "ID",

			referenceDatabase = this.#from.database,
			referenceTable,

			targetDatabase = this.#from.database,
			targetTable,
			targetField = "ID",

			fields = [],
			collapseOn,
			left = false
		} = options;

		const joinType = (left) ? "leftJoin" : "join";
		if (!referenceTable || !targetTable) {
			throw new sb.Error({
				message: "Both referenceTable and targetTable must be filled in!"
			});
		}

		this[joinType]({
			fromDatabase: sourceDatabase,
			fromTable: sourceTable,
			fromField: sourceField,
			toDatabase: referenceDatabase,
			toTable: referenceTable,
			// Yes, this field is literally the name of the source table. This is a strict, rigid requirement
			// for the database structure!
			toField: sourceTable
		});

		this[joinType]({
			fromDatabase: referenceDatabase,
			fromTable: referenceTable,
			// Yes, this field is literally the name of the target table. This is a strict, rigid requirement
			// for the database structure!
			fromField: targetTable,
			toDatabase: targetDatabase,
			toTable: targetTable,
			toField: targetField
		});

		this.#reference = {
			collapseOn: collapseOn ?? null,
			columns: fields,
			target: targetTable
		};

		return this;
	}

	/**
	 * Returns Recordset's WHERE condition.
	 * @returns {string}
	 */
	toCondition () {
		if (this.#where.length !== 0)  {
			return "(" + this.#where.join(") AND (") + ")";
		}
		else {
			return "";
		}
	}

	/**
	 * Translates Recordset to its SQL representation
	 * @returns {string[]}
	 * @throws {sb.Error} If no SELECT statement has been provided. The entire Recordset makes no sense should this happen
	 */
	toSQL () {
		if (this.#raw) {
			return this.#raw;
		}

		if (this.#select.length === 0) {
			throw new sb.Error({
				message: "No SELECT in Recordset - invalid definition"
			});
		}

		let sql = [];
		sql.push("SELECT " + this.#select.map(select => this.#query.escapeIdentifier(select)).join(", "));
		(this.#from) && sql.push("FROM `" + this.#from.database + "`.`" + this.#from.table + "`");
		(this.#join.length !== 0) && sql.push(this.#join.join(" "));
		(this.#where.length !== 0) && sql.push("WHERE (" + this.#where.join(") AND (") + ")");
		(this.#groupBy.length !== 0) && sql.push("GROUP BY " + this.#groupBy.join(", "));
		(this.#having.length !== 0) && sql.push("HAVING " + this.#having.join(", "));
		(this.#orderBy.length !== 0) && sql.push("ORDER BY " + this.#orderBy.join(", "));
		(this.#limit !== null) && sql.push("LIMIT " + this.#limit);
		(this.#offset !== null) && sql.push("OFFSET " + this.#offset);

		return sql;
	}

	/**
	 * Executes the SQL query and converts received values to their JS representation.
	 * @returns {Promise<Array>}
	 */
	async fetch () {
		const sql = this.toSQL();
		try {
			const rows = await this.#query.raw(...sql);

			let definition = {};
			for (const column of rows.meta) {
				definition[column.name()] = column.type;
			}

			let result = [];
			for (const row of rows) {
				for (const [name, value] of Object.entries(row)) {
					let type = definition[name];
					if (definition[name] === "LONGLONG" && !this.#options.bigint) {
						type = "LONG";
					}

					row[name] = this.#query.convertToJS(value, type);
				}

				result.push(row);
			}

			if (this.#reference?.collapseOn) {
				result = Recordset.collapseReferencedData(result, this.#reference);
			}

			// result.sql = sql;
			return (this.#fetchSingle)
				? result[0]
				: result;
		}
		catch (err) {
			console.error(err);
			throw err;
		}
	}

	static collapseReferencedData (originalData, options) {
		const keyMap = new Map();
		const data = JSON.parse(JSON.stringify(originalData));
		const { collapseOn: key, target, columns } = options;
		const regex = new RegExp("^" + target + "_");

		for (let i = data.length - 1; i >= 0; i--) {
			let skip = false;
			const row = data[i];
			
			if (!keyMap.has(row[key])) {
				keyMap.set(row[key], []);
			}
			else {
				skip = true;
			}
			
			const copiedProperties = {};
			for (const column of columns) {
				copiedProperties[column.replace(regex, "")] = row[column];
				delete row[column];
			}
			
			if (skip) {
				data.splice(i, 1);
			}
			
			keyMap.get(row[key]).push(copiedProperties);
		}
		
		for (const row of data) {
			row[target] = keyMap.get(row[key]);
		}
		
		return data;
	}
};

/**
 * @typedef {Object} WhereHavingParams
 * @property {boolean} [condition] If false, WHERE/HAVING will not be executed
 * @property {string} [raw] If present, WHERE/HAVING will not be parsed, and instead will directly use this string
 */

/**
 * @typedef {"%b"|"%d"|"%dt"|"%p"|"%n"|"%s"|"%t"|"%like"|"%*like"|"%like*"|"%*like*"} FormatSymbol
 */