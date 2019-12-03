/* global sb */
module.exports = (function () {
	"use strict";

	/**
	 * Represents a user's AFK status
	 * @memberof sb
	 * @type Platform
	 */
	return class Platform {
		/**
		 * @param {Object} data
		 * @param {number} data.User_Alias
		 * @param {sb.Date} data.Started
		 * @param {string} data.Text
		 * @param {boolean} data.Silent
		 */
		constructor (data) {
			/**
			 * Unique numeric platform identifier
			 * @type {User.ID}
			 */
			this.ID = data.ID;

			/**
			 * Unique platform name
			 * @type {string}
			 */
			this.Name = data.Name.toLowerCase();
		}

		get capital () {
			return sb.Utils.capitalize(this.Name);
		}

		/** @override */
		static async initialize () {
			await Platform.loadData();
			return Platform;
		}

		static async loadData () {
			Platform.data = (await sb.Query.getRecordset(rs => rs
				.select("*")
				.from("chat_data", "Platform")
			)).map(record => new Platform(record));
		}

		static async reloadData () {
			Platform.data = [];
			await Platform.loadData();
		}

		static get (identifier) {
			if (identifier instanceof Platform) {
				return identifier;
			}
			else if (typeof identifier === "number") {
				return Platform.data.find(i => i.ID === identifier);
			}
			else if (typeof identifier === "string") {
				return Platform.data.find(i => i.Name === identifier);
			}
			else {
				throw new sb.Error({
					message: "Unrecognized platform identifier type",
					args: typeof identifier
				});
			}
		}

		/**
		 * Cleans up.
		 */
		static destroy () {
			Platform.data = null;
		}
	};
})();