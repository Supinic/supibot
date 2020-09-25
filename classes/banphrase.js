/* global sb */
module.exports = (function () {
	"use strict";

	const apiDataSymbol = Symbol.for("banphrase-api-data");
	const apiResultSymbol = Symbol("banphrase-api-result");
	const inactiveSymbol = Symbol("banphrase-inactive");
	const availableTypes = ["API response", "Custom response", "Denial", "Inactive", "Replacement"];

	class ExternalBanphraseAPI {
		static async pajbot (message, URL) {
			const options = {
				method: "POST",
				url: "https://" + URL + "/api/v1/banphrases/test",
				body: new sb.URLParams()
					.set("message", message)
					.toString(),
				headers: {
					"Content-Type": "application/x-www-form-urlencoded"
				},
				timeout: sb.Config.get("PAJBOT_API_TIMEOUT")
			};

			const data = await sb.Got(options).json();
			data[apiResultSymbol] = Boolean(reply.banned ? reply.banphrase_data.phrase : false);
			data[apiDataSymbol] = data.banphrase_data;

			return data;
		}
	}

	/**
	 * Represents a banphrase, as a mirror of the database table Banphrase.
	 * @memberof sb
	 * @type Banphrase
	 */
	return class Banphrase {
		/**
		 * Unique numeric ID.
		 * @type {number|symbol}
		 */
		ID;

		/**
		 * Banphrase code.
		 * @type {Function}
		 */
		Code;

		/**
		 * Type of banphrase.
		 * Inactive: Banphrase is not active, will not be loaded or triggered.
		 * Denial: If the result is not undefined, there will be no reply at all.
		 * Replacement: Runs the message through String.prototype.replace and returns the result.
		 * Custom response: If the result is not undefined, the reply will be completely replaced with the result of the function.
		 * API response: Not technically a banphrase, simply returns custom text based on what a banphrase API returned.
		 * @type {("Denial","API response","Custom response","Replacement","Inactive")}
		 */
		Type;

		/**
		 * Platform of banphrase.
		 * @type {number|null}
		 */
		Platform = null;

		/**
		 * Channel of banphrase.
		 * If null, then the banphrase applies to the entire {@link module.Platform}.
		 * @type {number|null}
		 */
		Channel = null;

		/**
		 * @type {boolean}
		 * Determines if a banphrase is to be executed.
		 */
		Active;

		/**
		 * Wrapper for the instance's custom data.
		 * @type {Object}
		 */
		data = {};

		constructor (data) {
			this.ID = data.ID ?? Symbol();

			this.Code = eval(data.Code);
			if (typeof this.Code !== "function") {
				throw new sb.Error({
					message: `Banphrase ID ${this.ID} code must be a function`
				});
			}

			this.Type = data.Type;
			if (!availableTypes.includes(this.Type)) {
				throw new sb.Error({
					message: `Banphrase ID ${this.ID} type must be one of the supported types`
				});
			}

			this.Platform = data.Platform;

			this.Channel = data.Channel;

			this.Active = data.Active ?? true;
		}

		/**
		 * Executes the banphrase
		 * @param {string} message
		 * @returns {string|undefined}
		 */
		execute (message) {
			if (!this.Active) {
				return inactiveSymbol;
			}

			try {
				return this.Code(message);
			}
			catch (e) {
				console.warn("banphrase failed", message, this, e);
				return message;
			}
		}

		async toggle () {
			this.Active = !this.Active;
			if (typeof this.ID === "number") {
				await sb.Query.getRecordUpdater(ru => ru
				    .update("chat_data", "Banphrase")
				    .set("Active", this.Active)
				    .where("ID = %n", this.ID)
				);
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

		static get (identifier) {
			if (identifier instanceof Banphrase) {
				return identifier;
			}
			else if (typeof identifier === "number" || typeof identifier === "symbol") {
				const result = Banphrase.data.find(i => i.ID === identifier);
				return result ?? null;
			}
			else {
				throw new sb.Error({
					message: "Invalid banphrase identifier type",
					args: {
						id: identifier,
						type: typeof identifier
					}
				});
			}
		}

		/**
		 * Checks all banphrases associated with given channel and platform. Global ones are checked as well.
		 * If a channel is configured to use an external API, that is chcked too.
		 * @param {string} message
		 * @param {Channel|null} channelData
		 * @param {Object} options = {}
		 * @returns {Promise<BanphraseCheckResult>}
		 */
		static async execute (message, channelData, options = {}) {
			const banphraseList = Banphrase.data.filter(banphrase => (
				(banphrase.Type !== "API response") && (
					(banphrase.Channel === (channelData?.ID ?? null))
					|| (banphrase.Channel === null && banphrase.Platform === channelData?.Platform.ID)
					|| (banphrase.Platform === null)
				)
            ));

			for (const banphrase of banphraseList) {
				const result = await banphrase.execute(message);
				if (result === inactiveSymbol) {
					continue;
				}

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
			// Skip this check if it has been requested to be skipped
			if (!options.skipBanphraseAPI && channelData?.Banphrase_API_Type) {
				let response = null;
				try {
					const responseData = await Banphrase.executeExternalAPI(
						message.slice(0, 1000),
						channelData.Banphrase_API_Type,
						channelData.Banphrase_API_URL,
						{ fullResponse: true }
					);

					response = responseData[apiResultSymbol];
					if (response !== false) { // @todo platform-specific logging flag
						const row = await sb.Query.getRow("chat_data", "Banphrase_API_Denial_Log");
						row.setValues({
							API: channelData.Banphrase_API_URL,
							Channel: channelData.ID,
							Platform: channelData.Platform.ID,
							Message: message,
							Response: JSON.stringify(responseData[apiDataSymbol])
						});

						await row.save();
					}
				}
				catch (e) {
					const { code } = e;
					sb.Runtime.incrementBanphraseTimeouts(channelData.Name);

					switch (channelData.Banphrase_API_Downtime) {
						case "Ignore":
							return {
								string: message,
								passed: true,
								warn: true
							};

						case "Notify":
							return {
								string: `⚠ ${message}`,
								passed: true,
								warn: true
							};

						case "Nothing":
							return {
								string: null,
								passed: false,
								warn: false
							};

						case "Refuse": {
							const string = (code === "ETIMEDOUT")
								? `Banphrase API did not respond in time - cannot reply.`
								: `Banphrase API failed (${code}) - cannot reply.`;

							return {
								string,
								passed: false
							};
						}

						case "Whisper": {
							return {
								string: `Banphrase failed, your command result: ${message}.`,
								passed: true,
								privateMessage: true,
								warn: true
							};
						}
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
		 * @param {Object} options = {} extra options
		 * @param {boolean} [options.fullResponse] If true, returns the entire API response. Otherwise, returns
		 * string (if banphrased) or false.
		 * @returns {Promise<Object|string|boolean>} False if no banphrase found, string specifying tha banphrase otherwise.
		 */
		static async executeExternalAPI (message, type, URL, options = {}) {
			const reply = await ExternalBanphraseAPI[type.toLowerCase()](message, URL);
			if (options.fullResponse) {
				return reply;
			}
			else {
				return reply.banned
					? reply.banphrase_data.phrase
					: false;
			}
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