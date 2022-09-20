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
				url: `https://${URL}/api/v1/banphrases/test`,
				json: { message },
				timeout: sb.Config.get("PAJBOT_API_TIMEOUT"),
				retry: 1
			};

			/** @type {PajbotBanphraseAPIResponse} */
			const data = await sb.Got(options).json();
			data[apiResultSymbol] = Boolean(data.banned ? data.banphrase_data.phrase : false);
			data[apiDataSymbol] = data.banphrase_data;

			return data;
		}
	}

	class Banphrase extends require("./template.js") {
		ID;
		Code;
		Type;
		Platform = null;
		Channel = null;
		Active;
		data = {};

		constructor (data) {
			super();

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

		destroy () {
			this.data = null;
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

		async serialize () {
			throw new sb.Error({
				message: "Module Banphrase cannot be serialized"
			});
		}

		static async loadData () {
			const data = await sb.Query.getRecordset(rs => rs
				.select("Banphrase.*")
				.from("chat_data", "Banphrase")
				.where("Type <> %s", "Inactive")
				.orderBy("Priority DESC")
			);

			Banphrase.data = data.map(record => new Banphrase(record));
		}

		static async reloadSpecific (...list) {
			if (list.length === 0) {
				return false;
			}

			const promises = list.map(async (ID) => {
				const row = await sb.Query.getRow("chat_data", "Banphrase");
				await row.load(ID);

				const existingIndex = Banphrase.data.findIndex(i => i.ID === ID);
				if (existingIndex !== -1) {
					Banphrase.data[existingIndex].destroy();
					Banphrase.data.splice(existingIndex, 1);
				}

				if (!row.values.Active) {
					return;
				}

				const banphrase = new Banphrase(row.valuesObject);
				Banphrase.data.push(banphrase);
			});

			await Promise.all(promises);
			return true;
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
					await sb.Logger.log(
						"System.Warning",
						`Banphrase API fail - code: ${e.code ?? "N/A"}, message: ${e.message ?? "N/A"}`,
						channelData,
						null
					);

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
							let string;
							if (e.code === "ETIMEDOUT") {
								string = `Cannot reply - banphrase API timed out.`;
							}
							else if (e.code === "HTTPError") {
								const match = e.message.match(/Response code (\d+)/);
								const statusString = (match)
									? `(status code ${match[1]})`
									: "";

								string = `Cannot reply - banphrase API is currently down. ${statusString}`;
							}
							else {
								string = `Cannot reply - banphrase API encountered an unexpected error.`;
							}

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
						(banphrase.Type === "API response")
						&& (banphrase.Channel === channelData.ID || banphrase.Channel === null)
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
	}

	return Banphrase;
})();
