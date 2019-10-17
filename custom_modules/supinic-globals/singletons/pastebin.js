/* global sb */
module.exports = (function (Module) {
	"use strict";

	const postURL = "https://pastebin.com/api/api_post.php";
	const authURL = "https://pastebin.com/api/api_login.php";
	const allowedPrivacyOptions = ["public", "unlisted", "private"];
	const allowedExpirationOptions = {
		"never": "N",
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
	 * Extra news module, for countries that are not included in the news command.
	 * Constructor must be await-ed.
	 * @name sb.Pastebin
	 * @type Pastebin()
	 */
	return class Pastebin extends Module {
		/**
		 * @inheritDoc
		 * @returns {Pastebin}
		 */
		static async singleton () {
			if (!Pastebin.module){
				Pastebin.module = await new Pastebin();
			}
			return Pastebin.module;
		}

		constructor () {
			super();

			return (async () => {
				const authParams = new sb.URLParams()
					.set("api_dev_key", sb.Config.get("API_PASTEBIN"))
					.set("api_user_name", sb.Config.get("PASTEBIN_USER_NAME"))
					.set("api_user_password", sb.Config.get("PASTEBIN_PASSWORD"));

				try {
					this.authData = await sb.Utils.request({
						method: "POST",
						url: authURL,
						body: authParams.toString(),
						headers: {
							"Content-Type": "application/x-www-form-urlencoded",
							"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36"
						},
						timeout: 5000
					});
				}
				catch (e) {
					console.log("Pastebin intitialize error", e);
					this.authData = null;
				}

				return this;
			})();
		}

		/**
		 * Fetches a Pastebin paste, and returns the raw content.
		 * @param pasteID
		 * @returns {Promise<void>}
		 */
		async get (pasteID) {
			let data = null;
			try {
				data = await sb.Utils.request(`https://pastebin.com/raw/${pasteID}`);
			}
			catch (e) {
				console.error(e);
			}

			if (data && data.includes(`<title>Pastebin.com - Page Removed</title>`)) {
				data = null;
			}

			return data;
		}

		/**
		 * Posts given data to Pastebin. Returns a link to the created paste.
		 * @param {string} text
		 * @param {Object} options
		 * @param {string} [options.name]
		 * @param {number|string} [options.privacy]
		 * @param {string} [options.expiration]
		 * @param {string} [options.format]
		 * @returns {Promise<string>}
		 */
		async post (text, options = {}) {
			const params = new sb.URLParams()
				.set("api_dev_key", sb.Config.get("API_PASTEBIN"))
				.set("api_option", "paste")
				.set("api_paste_code", text)
				.set("api_paste_name", options.name || "untitled supibot paste")
				.set("api_paste_private", (options.privacy) ? Pastebin.getPrivacy(options.privacy) : "1")
				.set("api_paste_expire_date", (options.expiration) ? Pastebin.getExpiration(options.expiration) : "10M");

			if (this.authData) {
				params.set("api_user_key", this.authData);
			}

			if (options.format) {
				params.set("api_paste_format", options.format);
			}

			return await sb.Utils.request({
				method: "POST",
				url: postURL,
				body: params.toString(),
				timeout: 5000,
				headers: {
					"Content-Type": "application/x-www-form-urlencoded"
				}
			});
		}

		async delete (pasteID) {
			throw new sb.Error({
				message: "Not implemented yet."
			})
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
					args: arguments
				})
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
					args: arguments
				});
			}
		}

		get modulePath () { return "pastebin"; }

		/** @inheritDoc */
		destroy () {}
	};
});