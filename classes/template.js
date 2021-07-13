module.exports = class ClassTemplate {
	destroy () {}

	async serialize (row, properties, options) {
		const result = Object.entries(properties).map(([key, params]) => {
			const prop = row.values[key];
			if (typeof prop === "undefined") {
				throw new sb.Error({
					message: "Undefined value detected for serialized object",
					args: { key, params, name: this.name, ID: row.values.ID }
				});
			}
			else if (prop === null) {
				return `\t${key}: ${prop}`;
			}

			let value = prop;
			if (params.type === "json") {
				value = JSON.stringify(prop);
			}
			else if (typeof prop === "string") {
				value = prop.split(/\r?\n/).map((j, ind) => (ind === 0) ? j : `\t${j}`).join("\n");
			}

			if (value !== null && params.type === "string") {
				return `\t${key}: ${JSON.stringify(value)}`;
			}
			else {
				return `\t${key}: ${value}`;
			}
		}).join(",\n");

		const string = `module.exports = {\n${result}\n};`;
		if (options.filePath) {
			const fs = require("fs").promises;
			if (!options.overwrite) {
				let exists;
				try {
					await fs.access(options.filePath);
					exists = true;
				}
				catch {
					exists = false;
				}

				if (exists) {
					throw new sb.Error({
						message: "Cannot overwrite an existing file without the options.overwrite flag set"
					});
				}
			}

			await fs.writeFile(options.filePath, string);
		}

		return { string };
	}

	async getCacheData (key) {
		if (typeof key === "string") {
			key = { type: key };
		}

		return sb.Cache.getByPrefix(this.getCacheKey(), {
			keys: { ...key }
		});
	}

	async setCacheData (key, value, options = {}) {
		if (typeof value === "undefined") {
			throw new sb.Error({
				message: "Value must be passed to cache"
			});
		}

		if (typeof key === "string") {
			key = { type: key };
		}

		return sb.Cache.setByPrefix(this.getCacheKey(), value, {
			keys: { ...key },
			...options
		});
	}

	async saveRowProperty (row, property, value, self) {
		if (!sb.Query.isRow(row)) {
			throw new sb.Error({
				message: "First argument must be an instance of Row",
				args: {
					type: row?.constructor?.name ?? typeof row
				}
			});
		}
		else if (!row.hasProperty(property)) {
			throw new sb.Error({
				message: "Row does not have provided property",
				args: {
					property,
					properties: Object.keys(row.valuesObject)
				}
			});
		}
		else if (!row.loaded) {
			throw new sb.Error({
				message: "Row must be loaded before any properties can be saved"
			});
		}

		if (typeof value !== "undefined") {
			self[property] = value;
		}
		else {
			value = self[property];
		}

		if (value?.constructor === Object) {
			value = JSON.stringify(value);
		}

		row.values[property] = value;
		await row.save();
	}

	static data = [];

	static async initialize () {
		await this.loadData();
		return this;
	}

	static async loadData () {
		throw new sb.Error({
			message: "loadData method must be implemented in module",
			args: {
				name: this.name
			}
		});
	}

	static async reloadData () {
		this.data = [];
		await this.loadData();
	}

	/**
	 * @returns {Promise<boolean>} determines operation success/failure
	 */
	static async reloadSpecific () {
		throw new sb.Error({
			message: "Module does not implement reloadSpecific"
		});
	}

	/**
	 * Determines whether a child class has its own implemenation of `reloadSpecific`
	 * @returns {boolean}
	 */
	static hasReloadSpecific () {
		return (this.reloadSpecific !== ClassTemplate.reloadSpecific);
	}

	static async get () {
		throw new sb.Error({
			message: "get method must be implemented in module"
		});
	}

	/**
	 * Cleans up the module.
	 */
	static destroy () {
		this.data = null;
	}
};
