const config = require("../config.json");
const { defaultUserAgent } = config.modules.gots;

let loginEnvsMissingNotifier = false;
const loginEnvs = [
	"API_PASTEBIN",
	"PASTEBIN_USER_NAME",
	"PASTEBIN_PASSWORD"
];

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
 */
module.exports = class PastebinSingleton {
	#authData = null;
	#authenticationPending = false;
	#got = sb.Got.extend({
		throwHttpErrors: false,
		prefixUrl: "https://pastebin.com/",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			"User-Agent": defaultUserAgent
		}
	});

	/**
	 * Attempts to log in and preserves authentication data.
	 * @returns {Promise<void>}
	 */
	async login () {
		if (this.#authData || this.#authenticationPending) {
			return;
		}
		else if (loginEnvs.some(key => !process.env[key])) {
			if (!loginEnvsMissingNotifier) {
				console.debug("Pastebin module is missing env configs, will not attempt to log in.");
				loginEnvsMissingNotifier = true;
			}

			return;
		}

		this.#authenticationPending = true;

		const { body, statusCode } = await this.#got({
			method: "POST",
			url: "api/api_login.php",
			timeout: {
				request: 5000
			},
			body: new URLSearchParams({
				api_dev_key: process.env.API_PASTEBIN,
				api_user_name: process.env.PASTEBIN_USER_NAME,
				api_user_password: process.env.PASTEBIN_PASSWORD
			}).toString()
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

		const params = new URLSearchParams({
			api_dev_key: process.env.API_PASTEBIN,
			api_option: "paste",
			api_paste_code: text,
			api_paste_name: options.name || "untitled Supibot paste",
			api_paste_private: (options.privacy) ? PastebinSingleton.getPrivacy(options.privacy) : "1",
			api_paste_expire_date: (options.expiration)
				? PastebinSingleton.getExpiration(options.expiration)
				: "10M"
		});

		if (this.#authData) {
			params.append("api_user_key", this.#authData);
		}
		if (options.format) {
			params.append("api_paste_format", options.format);
		}

		const { statusCode, body } = await this.#got({
			method: "POST",
			throwHttpErrors: false,
			url: "api/api_post.php",
			body: params.toString(),
			timeout: {
				request: 5000
			}
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
