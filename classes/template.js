module.exports = class ClassTemplate {
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
		
		return sb.Cache.setByPrefix(this.getCacheKey(), value, {
			keys: { ...key },
			...options
		});
	}
	
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