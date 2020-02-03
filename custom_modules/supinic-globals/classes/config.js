/* global sb */
module.exports = (function () {
	"use strict";

	const { randomBytes, createCipheriv, createDecipheriv} = require("crypto");
	const key = randomBytes(32);
	const iv = randomBytes(16);
	const type = "aes-256-ofb";

	const encode = (string) => {
		const cipher = createCipheriv(type, key, iv);
		cipher.update(string);
		return cipher.final();
	};
	const decode = (string) => {
		const cipher = createDecipheriv(type, key, iv);
		cipher.update(string);
		return cipher.final();
	};

	/**
	 * Exposes configuration variables.
	 * @name sb.Config
	 * @type Config()
	 */
	return class Config {
		#Name;
		#Value;
		#Type;
		#Unit;
		#Secret;
		#Editable;
		#locked = false;

		constructor (data) {
			this.#Name = data.Name;
			this.#Type = data.Type;
			this.#Unit = data.Unit;
			this.#Secret = Boolean(data.Secret);

			this.#Editable = true;
			this.value = data.Value;
			this.#Editable = Boolean(data.Editable);
		}

		lock () {
			if (!this.#Secret || this.#Type !== "string" || this.#locked) {
				return;
			}

			this.#Value = encode(this.#Value);
			this.#locked = true;
		}

		unlock () {
			if (!this.#Secret || this.#Type !== "string" || !this.#locked) {
				return;
			}

			this.#Value = decode(this.#Value);
			this.#locked = false;
		}

		get name () { return this.#Name; }
		get editable () { return this.#Editable; }

		get value () { return this.#Value; }
		set value (value) {
			if (!this.#Editable) {
				throw new sb.Error({
					message: "Config variable is not editable"
				});
			}

			switch (this.#Type) {
				case "boolean":
					this.#Value = (value === "1");
					break;
				case "string":
					this.#Value = String(value);
					break;
				case "number":
					this.#Value = Number(value);
					break;
				case "date":
					this.#Value = new sb.Date(value);
					break;
				case "regex":
					// Split to obtain flags - if none are present, none will be used
					try {
						this.#Value = new RegExp(...value.replace(/^\/|\/$/g, "").split(/\/(?=[gmi])/).filter(Boolean));
					}
					catch (e) {
						console.warn("Incorrect value for config regex", e);
						this.#Value = /.*/;
					}
					break;
				case "array":
				case "object":
					try {
						this.#Value = JSON.parse(value);
					}
					catch (e) {
						console.warn(`Config variable ${name} has invalid definition`, e);
						this.#Value = (type === "array") ? [] : {};
					}
					break;
				case "function":
					try {
						this.#Value = eval(value);
						if (typeof this.#Value !== "function") {
							console.warn(`Config function variable ${name} does not return a function`, e);
							this.#Value = function empty () { };
						}
					}
					catch (e) {
						console.warn(`Config function variable ${name} has invalid definition`, e);
						this.#Value = function empty () { };
					}
					break;

				default: throw new sb.Error({
					message: "Unrecognized config variable type",
					args: this.#Type
				});
			}
		}
		
		static async initialize () {
			Config.data = new Map();
			await Config.loadData();
			return Config;
		}

		static async loadData () {
			const data = await sb.Query.getRecordset(rs => rs
				.select("*")
				.from("data", "Config")
			);

			for (const record of data) {
				const object = new Config(record);
				Config.data.set(record.Name, object);
			}
		}

		static async reloadData () {
			Config.data.clear();
			await Config.loadData();
		}

		 /**
		 * Fetches the given configuration variable
		 * @param {string} variable Variable name
		 * @returns {*}
		 * @throws {sb.Error} If variable does not exists
		 */
		static get (variable) {
			const target = Config.data.get(variable);
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
		static async set (variable, value) {
			const target = Config.data.get(variable);
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

			target.value = value;

			await sb.Query.getRecordUpdater(rs => rs
				.update("data", "Config")
				.set("Value = %s", target.value)
				.where("Name = %s", variable)
			);
		}

		/** @inheritDoc */
		destroy () {
			Config.data.clear();
		}
	};
})();