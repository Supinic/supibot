let loginConfigMissingNotified = false;
const loginConfigs = [
	"API_PASTEBIN",
	"PASTEBIN_USER_NAME",
	"PASTEBIN_PASSWORD"
];

module.exports = (function () {
	"use strict";

	const errorStrings = {
		get: {
			403: "This is a private paste or it is pending moderation!",
			default: "Error while getting the paste!"
		},
		post: {
			422: "This paste was rejected by Pastebin's SMART filters!",
			default: "Error while posting the paste!"
		}
	};

	const allowedPrivacyOptions = ["public", "unlisted", "private"];
	const allowedExpirationOptions = {
		never: "N",
		"10 minutes": "10M",
		"1 hour": "1H",
		"1 day": "1D",
		"1 week": "1W",
		"2 weeks": "2W",
		"1 month": "1M",
		"6 months": "6M",
		"1 year": "1Y"
	};

	/**
	 * Pastebin module: allows easy get/post methods with potential authentication, if so desired.
	 * @memberof sb
	 */
	return class Pastebin extends require("./template.js") {
		#authData = null;
		#authenticationPending = false;
		#got = sb.Got.extend({
			throwHttpErrors: false,
			prefixUrl: "https://pastebin.com/",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				"User-Agent": sb.Config.get("DEFAULT_USER_AGENT")
			}
		});

		/**
		 * @inheritDoc
		 * @returns {Pastebin}
		 */
		static async singleton () {
			if (!Pastebin.module) {
				Pastebin.module = new Pastebin();
			}
			return Pastebin.module;
		}

		/**
		 * Attempts to log in and preserves authentication data.
		 * @returns {Promise<void>}
		 */
		async login () {
			if (this.#authData || this.#authenticationPending) {
				return;
			}
			else if (loginConfigs.some(key => !sb.Config.has(key))) {
				if (!loginConfigMissingNotified) {
					console.debug("Pastebin module is missing login configs, will not attempt to log in.");
					loginConfigMissingNotified = true;
				}

				return;
			}

			this.#authenticationPending = true;

			const { body, statusCode } = await this.#got({
				method: "POST",
				url: "api/api_login.php",
				timeout: 5000,
				body: new sb.URLParams()
					.set("api_dev_key", sb.Config.get("API_PASTEBIN"))
					.set("api_user_name", sb.Config.get("PASTEBIN_USER_NAME"))
					.set("api_user_password", sb.Config.get("PASTEBIN_PASSWORD"))
					.toString()
			});

			this.#authenticationPending = false;

			if (statusCode !== 200) {
				this.#authData = null;
			}
			else {
				this.#authData = body;
			}
		}

		/**
		 * @typedef {Object} PastebinResponse
		 * @property {boolean} success
		 * @property {string|null} body
		 * @property {string|null} error
		 */
		/**
		 * Fetches a Pastebin paste, and returns the raw content.
		 * @param pasteID
		 * @returns {Promise<PastebinResponse>}
		 */
		async get (pasteID) {
			const { body, statusCode } = await this.#got(`raw/${pasteID}`);
			if (statusCode === 200) {
				return {
					success: true,
					body,
					error: null
				};
			}
			else {
				return {
					success: false,
					body: null,
					error: errorStrings.get[statusCode] ?? errorStrings.get.default
				};
			}
		}

		/**
		 * Posts given data to Pastebin. Returns a link to the created paste.
		 * @param {string} text
		 * @param {Object} options
		 * @param {string} [options.name]
		 * @param {number|string} [options.privacy]
		 * @param {string} [options.expiration]
		 * @param {string} [options.format]
		 * @returns {Promise<PastebinResponse>}
		 */
		async post (text, options = {}) {
			if (!this.#authData) {
				await this.login();
			}

			const params = new sb.URLParams()
				.set("api_dev_key", sb.Config.get("API_PASTEBIN"))
				.set("api_option", "paste")
				.set("api_paste_code", text)
				.set("api_paste_name", options.name || "untitled supibot paste")
				.set("api_paste_private", (options.privacy) ? Pastebin.getPrivacy(options.privacy) : "1")
				.set("api_paste_expire_date", (options.expiration) ? Pastebin.getExpiration(options.expiration) : "10M");

			if (this.#authData) {
				params.set("api_user_key", this.#authData);
			}

			if (options.format) {
				params.set("api_paste_format", options.format);
			}

			const { statusCode, body } = await this.#got({
				method: "POST",
				throwHttpErrors: false,
				url: "api/api_post.php",
				body: params.toString(),
				timeout: 5000
			});

			if (statusCode === 200) {
				return {
					success: true,
					body,
					error: null
				};
			}
			else {
				return {
					success: false,
					body: null,
					error: errorStrings.post[statusCode] ?? errorStrings.post.default
				};
			}
		}

		async delete () {
			throw new sb.Error({
				message: "Not implemented yet."
			});
		}

		/**
		 * Parses out privacy options.
		 * @param {string|number} mode
		 * @returns {string}
		 */
		static getPrivacy (mode) {
			if (typeof mode === "number" && mode >= 0 && mode <= 2) {
				return String(mode);
			}
			else if (typeof mode === "string" && allowedPrivacyOptions.includes(mode)) {
				return String(allowedPrivacyOptions.indexOf(mode));
			}
			else {
				throw new sb.Error({
					message: "Pastebin: Invalid privacy option",
					args: { mode }
				});
			}
		}

		static getExpiration (string) {
			if (Object.values(allowedExpirationOptions).includes(string)) {
				return string;
			}
			else if (allowedExpirationOptions[string]) {
				return allowedExpirationOptions[string];
			}
			else {
				throw new sb.Error({
					message: "Pastebin: Invalid expiration option",
					args: { string }
				});
			}
		}

		get modulePath () { return "pastebin"; }

		/** @inheritDoc */
		destroy () {}
	};
})();
