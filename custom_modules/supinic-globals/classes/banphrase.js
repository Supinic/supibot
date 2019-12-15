/* global sb */
module.exports = (function () {
	"use strict";

	class ExternalBanphraseAPI {
		static async pajbot (message, URL) {
			const options = {
				method: "POST",
				url: "https://" + URL + "/api/v1/banphrases/test",
				body: "message=" + sb.Utils.argsToFixedURL(message.split(" ")),
				headers: {
					"Content-Type": "application/x-www-form-urlencoded"
				},
				timeout: sb.Config.get("PAJBOT_API_TIMEOUT"),
				maxAttempts: 3,
				retryDelay: 500,
				fullResponse: false
			};

			const data = JSON.parse(await sb.Utils.requestRetry(options));
			return (data.banned)
				? data.banphrase_data.phrase
				: false;
		}
	}

	/**
	 * Represents a banphrase, as a mirror of the database table Banphrase.
	 * @memberof sb
	 * @type Banphrase
	 */
	return class Banphrase {
		constructor (data) {
			/**
			 * Unique numeric ID.
			 * @type {number}
			 */
			this.ID = data.ID;

			try {
				data.Code = eval(data.Code);
			}
			catch (e) {
				throw new sb.Error({
					message: "Banphrase " + data.ID + " has invalid code definition: " + e.toString()
				});
			}

			/**
			 * Banphrase code.
			 * @type {Function}
			 */
			this.Code = data.Code;

			/**
			 * Type of banphrase.
			 * Inactive: Banphrase is not active, will not be loaded or triggered.
			 * Denial: If the result is not undefined, there will be no reply at all.
			 * Replacement: Runs the message through String.prototype.replace and returns the result.
			 * Custom response: If the result is not undefined, the reply will be completely replaced with the result of the function.
			 * API response: Not technically a banphrase, simply returns custom text based on what a banphrase API returned.
			 * @type {("Denial","API response","Custom response","Replacement","Inactive")}
			 */
			this.Type = data.Type;

			/**
			 * Platform of banphrase.
			 * @type {Platform}
			 */
			this.Platform = (data.Platform)
				? sb.Platform.get(data.Platform)
				: null;

			/**
			 * Channel of banphrase.
			 * If null, then the banphrase applies to the entire {@link module.Platform}.
			 * @type {number|null}
			 */
			this.Channel = data.Channel;
		}

		/**
		 * Executes the banphrase
		 * @param {string} message
		 * @returns {string|undefined}
		 */
		execute (message) {
			try {
				return this.Code(message);
			}
			catch (e) {
				console.warn("banphrase failed", message, this, e);
				return message;
			}
		}

		/** @override */
		static async initialize () {
			await Banphrase.loadData();
			return Banphrase;
		}

		static async loadData () {
			Banphrase.data = (await sb.Query.getRecordset(rs => rs
				.select("Banphrase.*")
				.from("chat_data", "Banphrase")
				.where("Type <> %s", "Inactive")
				.orderBy("Priority DESC")
			)).map(record => new Banphrase(record));
		}

		static async reloadData () {
			Banphrase.data = [];
			await Banphrase.loadData();
		}

		/**
		 * Checks all banphrases associated with given channel and platform. Global ones are checked as well.
		 * If a channel is configured to use an external API, that is chcked too.
		 * @param {string} message
		 * @param {Channel|null} channelData
		 * @returns {Promise<BanphraseCheckResult>}
		 */
		static async execute (message, channelData) {
			const banphraseList = Banphrase.data.filter(banphrase => (
				(banphrase.Type !== "API response") && (
					(banphrase.Channel === (channelData?.ID ?? null))
					|| (banphrase.Channel === null && banphrase.Platform === channelData?.Platform)
					|| (banphrase.Platform === null)
				)
            ));

			for (const banphrase of banphraseList) {
				const result = await banphrase.execute(message);
				if (typeof result !== "undefined") {
					// Return immediately if the message was deemed to be ignored, or responded to with a custom response
					if (banphrase.Type !== "Replacement") {
						return { string: result || null, passed: false };
					}
					// Otherwise, keep replacing the banphrases in a message
					else {
						message = result;
					}
				}
				// If the result is undefined, that means current banphrasea was not triggered. Keep going.
			}

			// If channel has a banphrase API, check it afterwards
			if (channelData?.Banphrase_API_Type) {
				let response = null;
				try {
					response = await Banphrase.executeExternalAPI(
						message.slice(0, 1000),
						channelData.Banphrase_API_Type,
						channelData.Banphrase_API_URL
					);
				}
				catch {
					sb.Runtime.incrementBanphraseTimeouts(channelData.Name);

					switch (channelData.Banphrase_API_Downtime) {
						case "Ignore":
							return {
								string: message,
								passed: true
							};

						case "Notify":
							return {
								string: sb.Config.get("BANPHRASE_API_UNREACHABLE_NOTIFY") + " " + message,
								passed: true
							};

						default:
						case "Refuse":
							return {
								string: sb.Config.get("DEFAULT_BANPHRASE_API_TIMEOUT_RESPONSE"),
								passed: false
							};
					}
				}

				// If the message is banphrased, check for API responses and return one accordingly.
				// If not found, return a default one.
				if (response !== false) {
					const apiResponses = Banphrase.data.filter(banphrase => (
						(banphrase.Type === "API response") &&
						(banphrase.Channel === channelData.ID || banphrase.Channel === null)
					));

					for (const response of apiResponses) {
						const result = response.Code(message);
						if (typeof result !== "undefined") {
							return result;
						}
					}

					console.warn("No custom reply for API banphrase", {
						channel: channelData.Name,
						message: message,
						response: response
					});

					return {
						string: sb.Config.get("DEFAULT_BANPHRASE_API_RESPONSE"),
						passed: false
					};
				}
			}

			return { string: message, passed: true };
		}

		/**
		 * Checks an external banphrase API.
		 * @param {string} message
		 * @param {("Pajbot")} type Type of banphrase API - required to build request URL and data parsing
		 * @param {string} URL Banphrase API URL
		 * @returns {Promise<string|boolean>} False if no banphrase found, string specifying tha banphrase otherwise.
		 */
		static async executeExternalAPI (message, type, URL) {
			return await ExternalBanphraseAPI[type.toLowerCase()](message, URL);
		}

		static destroy () {
			Banphrase.data = null;
		}
	};
})();

/**
 * @typedef {Object} BanphraseCheckResult
 * @property {string|null} string Resulting string. Can be null, if it was deemed there should be no reply at all.
 * @property {boolean} passed If true, no banphrases were triggered; otherwise false.
 */