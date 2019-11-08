/* global sb */
module.exports = (function (Module) {
	"use strict";

	/**
	 * Module for logging various events to database.
	 * @name sb.SystemLogger
	 * @type SystemLogger()
	 */
	return class SystemLogger extends Module {
		/**
		 * @inheritDoc
		 * @returns {SystemLogger}
		 */
		static singleton () {
			if (!SystemLogger.module) {
				SystemLogger.module = new SystemLogger();
			}
			return SystemLogger.module;
		}

		/**
		 * Inserts a system log to the database.
		 * @param {CompoundSystemLogTag} tag
		 * @param {string} [description] = null
		 * @param {Channel} [channel] = null
		 * @param {User} [user] = null
		 * @returns {Promise<void>}
		 */
		async send (tag, description = null, channel = null, user = null) {
			const [parentTag, childTag = null] = tag.split(".");

			const row = await sb.Query.getRow("chat_data", "Log");
			row.setValues({
				Tag: parentTag,
				Subtag: childTag,
				Description: (typeof description === "string")
					? description.slice(0, 1000)
					: description,
				Channel: (channel) ? channel.ID : null,
				User_Alias: (user) ? user.ID : null
			});
			await row.save();
		}

		/**
		 * Logs a new error, and returns its ID.
		 * @param {string} tag
		 * @param {Error} error
		 * @param {*[]} [args] Any additional arguments passed to code that produced this error
		 * @returns {Promise<void>}
		 */
		async sendError (tag, error, ...args) {
			const row = await sb.Query.getRow("chat_data", "Error");
			row.setValues({
				Type: tag,
				Message: error.message ?? null,
				Stack: error.stack,
				Arguments: (args) ? JSON.stringify(args) : null
			});

			const { insertId } = await row.save();
			return insertId;
		}

		get modulePath () { return "system-log"; }

		destroy () { }
	};
});

/**
 * @typedef {string} CompoundSystemLogTag
 * @value {'Command','Message','Twitch','Discord','Cytube','Module','System'} Tag
 * @value {'Request','Fail','Load','Warning','Success','Ban','Shadowban','Clearchat','Sub','Giftsub','Host','Error','Timeout','Other','Restart'} Subtag
 */