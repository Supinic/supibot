/* global sb */
module.exports = (function () {
	"use strict";

	/**
	* Represents a user's AFK status
	* @memberof sb
	* @type AwayFromKeyboard
	*/
	return class AwayFromKeyboard {
		/**
		 * @param {Object} data
		 * @param {number} data.User_Alias
		 * @param {sb.Date} data.Started
		 * @param {string} data.Text
		 * @param {boolean} data.Silent
		 */
		constructor (data) {
			/**
			 * Unique numeric user identifier
			 * @type {User.ID}
			 */
			this.User_Alias = data.User_Alias;

			/**
			 * The timestamp of AFK status setup
			 * @type {sb.Date}
			 */
			this.Started = data.Started;

			/**
			 * AFK status description
			 * @type {string}
			 */
			this.Text = data.Text;

			/**
			 * If true, the AFK status will not be broadcasted when the user comes back from AFK
			 * @type {boolean}
			 */
			this.Silent = data.Silent;

			/**
			 * Determines the sort of "action" the user was doing while being AFK.
			 * E.g. "no longer AFK", "no longer taking a shower", ...
			 * @type {string}
			 */
			this.Status = data.Status || "afk";
		}

		/** @override */
		static async initialize () {
			await AwayFromKeyboard.loadData();
			return AwayFromKeyboard;
		}

		static async loadData () {
			AwayFromKeyboard.data = (await sb.Query.getRecordset(rs => rs
				.select("*")
				.from("chat_data", "AFK")
				.where("Active = %b", true)
			)).map(record => new AwayFromKeyboard(record));
		}

		static async reloadData () {
			AwayFromKeyboard.data = [];
			await AwayFromKeyboard.loadData();
		}

		/**
		 * Checks if an user is AFK.
		 * If they are, returns their AFK data and unsets the AFK status.
		 * If the status is set as not silent, also emits an event to Master to send a message
		 * @param {User} userData
		 * @param {Channel} channelData
		 * @returns {Promise<void>}
		 */
		static async checkActive (userData, channelData) {
			const index = AwayFromKeyboard.data.findIndex(i => i.User_Alias === userData.ID);
			if (index === -1) {
				return;
			}

			// This should only ever update one row, if everything is working properly
			await sb.Query.getRecordUpdater(rs => rs
				.update("chat_data", "AFK")
				.set("Active", false)
				.where("Active = %b", true)
				.where("User_Alias = %n", userData.ID)
			);

			const data = AwayFromKeyboard.data[index];
			const status = sb.Utils.randArray(sb.Config.get("AFK_RESPONSES")[data.Status]);
			if (!data.Silent) {
				const message = `${userData.Name} ${status}: ${data.Text} (${sb.Utils.timeDelta(data.Started)})`;
				if (channelData.Mirror) {
					sb.Master.mirror(message, userData, channelData.Mirror);
				}

				const fixedMessage = (await Promise.all([
					sb.Master.prepareMessage(userData.Name + " " + status + ":", channelData),
					sb.Master.prepareMessage(data.Text || "(no message)", channelData),
					"(" + sb.Utils.timeDelta(data.Started) + ")"
				])).join(" ");

				sb.Master.send(fixedMessage, channelData);
			}

			AwayFromKeyboard.data.splice(index, 1);
		}

		/**
		 * Sets a user's AFK status.
		 * @param {User} userData
		 * @param {string} text
		 * @param {string} status
		 * @param {boolean} [silent] If true, user coming back will not be broadcast.
		 * @returns {Promise<void>}
		 */
		static async set (userData, text, status, silent) {
			const now = new sb.Date();
			const data = {
				User_Alias: userData.ID,
				Text: text || null,
				Silent: !!silent,
				Started: now,
				Status: status || "afk"
			};

			const row = await sb.Query.getRow("chat_data", "AFK");
			row.setValues(data);
			await row.save();

			AwayFromKeyboard.data.push(new AwayFromKeyboard(data));
		}

		/**
		 * Cleans up.
		 */
		static destroy () {
			AwayFromKeyboard.data = null;
		}
	};
})();