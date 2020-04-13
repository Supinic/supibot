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
		 * Platform controller
		 * @type {Controller}
		 */
		#controller = null;

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

		/**
		 * Determines if a user is an "owner" of a given channel in the platform.
		 * @param channel
		 * @param user
		 * @returns {null|boolean}
		 */
		isUserChannelOwner (channel, user) {
			if (typeof this.#controller.isUserChannelOwner !== "function") {
				return null;
			}

			return this.#controller.isUserChannelOwner(channel, user);
		}

		destroy () {
			this.#controller = null;
		}

		/**
		 * Platform controller
		 * @type {Controller}
		 */
		get controller () {
			return this.#controller;
		}

		get client () {
			return this?.#controller?.client ?? null;
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
		 * Assigns controllers to each platform after they have been prepared.
		 * @param {Object<string, Controller>}controllers
		 */
		static assignControllers (controllers) {
			for (const [name, controller] of Object.entries(controllers)) {
				const platform = Platform.get(name);
				if (platform) {
					platform.#controller = controller;
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