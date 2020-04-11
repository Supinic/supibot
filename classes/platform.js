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

			/**
			 * Platform client
			 * @type {Client|null}
			 */
			this.client = null;
		}

		get capital () {
			return sb.Utils.capitalize(this.Name);
		}

		/**
		 * Determines if a user is an "owner" of a given channel in the platform.
		 * @param channel
		 * @param user
		 * @returns {null|boolean}
		 */
		isUserChannelOwner (channel, user) {
			if (typeof this?.client?.isUserChannelOwner !== "function") {
				return null;
			}

			return this.client.isUserChannelOwner(channel, user);
		}

		destroy () {
			this.client = null;
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

		/**
		 * Assigns clients to each platform after the clients have been prepared properly.
		 * @param {Object<string, Client>}clients
		 */
		static assignClients (clients) {
			for (const [name, client] of Object.entries(clients)) {
				const platform = Platform.get(name);
				if (platform) {
					platform.client = client;
				}
			}
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
			for (const platform of Platform.data) {
				platform.destroy();
			}

			Platform.data = null;
		}
	};
})();