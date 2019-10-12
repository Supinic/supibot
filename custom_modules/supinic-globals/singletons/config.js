/* global sb */
module.exports = (function (Module) {
	"use strict";

	/**
	 * @todo
	 * Implement cryptographic protection for API keys (Secret === true)
	 */

	/**
	 * Exposes configuration variables as they are set up in the database table Config.
	 * Constructor must be await-ed.
	 * @name sb.Config
	 * @type Config()
	 */
	return class Config extends Module {
		/**
		 * @inheritDoc
		 * @returns {Config}
		 */
		static async singleton () {
			if (!Config.module) {
				Config.module = await new Config();
			}
			return Config.module;
		}

		/**
		 * Parses a variable based on a given type.
		 * @param {string} type
		 * @param {*} value
		 * @param {string} name
		 */
		static parseVariable (type, value, name) {
			let returnValue = null;
			switch (type) {
				case "boolean":
					returnValue = (value === "1");
					break;
				case "string":
					returnValue = String(value);
					break;
				case "number":
					returnValue = Number(value);
					break;
				case "date":
					returnValue = new sb.Date(value);
					break;

				// Split to obtain flags - if none are present, none will be used
				case "regex":
					try {
						returnValue = new RegExp(...value.replace(/^\/|\/$/g, "").split(/\/(?=[gmi])/).filter(Boolean));
					}
					catch (e) {
						console.warn("Incorrect value for config regex", e);
						returnValue = /.*/;
					}
					break;

				case "array":
				case "object":
					try {
						returnValue = JSON.parse(value);
					}
					catch (e) {
						console.warn(`Config variable ${name} has invalid definition`, e);
						returnValue = (type === "array") ? [] : {};
					}
					break;

				case "function":
					try {
						returnValue = eval(value);
						if (typeof returnValue !== "function") {
							console.warn(`Config function variable ${name} does not return a function`, e);
							returnValue = function empty () { };
						}
					}
					catch (e) {
						console.warn(`Config function variable ${name} has invalid definition`, e);
						returnValue = function empty () { };
					}
					break;

				default:
					throw new sb.Error({
						message: "Unrecognized config variable type",
						args: type
					});
			}

			return returnValue;
		}

		constructor () {
			super();
			this.configData = new Map();
			return this.loadData();
		}

		/**
		 * Loads the configuration from database.
		 * @returns {Promise<Config>}
		 */
		async loadData () {
			const data = await sb.Query.getRecordset(rs => rs
				.select("Name", "Type", "Value", "Secret", "Editable")
				.from("data", "Config")
			);

			for (const row of data) {
				this.configData.set(row.Name, {
					type: row.Type,
					editable: row.Editable,
					secret: row.Secret,
					value: Config.parseVariable(row.Type, row.Value, row.Name)
				});
			}

			for (const variable of this.configData.keys()) {
				if (!data.find(i => i.Name === variable)) {
					this.configData.delete(variable);
				}
			}

			return this;
		}

		/**
		 * Reloads the configuration.
		 * @returns {Promise<Config>}
		 */
		async reloadData () {
			return await this.loadData();
		}

		/**
		 * Fetches the given configuration variable
		 * @param {string} variable Variable name
		 * @returns {*}
		 * @throws {sb.Error} If variable does not exists
		 */
		get (variable) {
			const target = this.configData.get(variable);
			if (!target) {
				throw new sb.Error({
					message: "Configuration variable does not exist",
					args: variable
				});
			}

			return target.value;
		}

		/**
		 * Sets the configuration variable
		 * @param {string} variable Variable name
		 * @param {*} value New variable value
		 * @throws {sb.Error} If variable does not exists
		 * @throws {sb.Error} If variable is not editable
		 * @throws {sb.Error} If value type is incompatible with the variable type
		 */
		async set (variable, value) {
			const target = this.configData.get(variable);
			if (!target) {
				throw new sb.Error({
					message: "Configuration variable does not exist",
					args: variable
				});
			}

			if (!target.editable) {
				throw new sb.Error({
					message: "Configuration variable is not editable",
					args: variable
				});
			}

			target.value = Config.parseVariable(
				this.configData.get(variable).type,
				value
			);

			await sb.Query.raw([
				"UPDATE data.Config",
				"SET Value = " + sb.Query.convertToSQL(this.configData.get(variable).value, "string"),
				"WHERE Name = " + sb.Query.convertToSQL(variable, "string")
			].join(" "));
		}

		get modulePath () { return "config"; }

		/** @inheritDoc */
		destroy () {
			this.configData.clear();
		}
	};
});