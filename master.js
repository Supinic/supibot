(async function () {
	"use strict";

	process.env.PROJECT_TYPE = "bot";

	/** Database access keys are loaded here, and stored to process.env */
	require("./db-access");

	/**
	 * The global bot namespace.
	 * Used for various utilities, prototype changes and custom classes.
	 * Assigned to global.sb upon requiring the globals module.
	 */
	await require("supi-core")("sb");

	/**
	 * Master client instance.
	 * Holds control over all clients.
	 * @type Master
	 */
	class Master {
		constructor () {
			this.flags = {};
			this.data = {};

			const initialChannels = sb.Channel.data.filter(i => i.Mode !== "Inactive");
			const initialPlatforms = new Set(initialChannels.map(i => i.Platform.Name));

			this.controllers = {};
			for (const platform of initialPlatforms) {
				/** @type Controller */
				let Controller = null;
				try {
					Controller = require("./controllers/" + platform);
				}
				catch (e) {
					console.error("Require of " + platform + " controller module failed", e);
					continue;
				}

				try {
					this.controllers[platform] = new Controller();
				}
				catch (e) {
					console.error("Initialization of " + platform + " controller module failed", e);
					continue;
				}

				console.debug(`Platform ${platform} loaded successfully.`);
			}

			this.started = new sb.Date();
			this.restarted = new sb.Date();
		}

		/**
		 * Prepares a message to be sent in the provided channel.
		 * Checks banphrases, respects length limits.
		 * Ignores if channel is inactive or read-only
		 * @param {string} message
		 * @param {Channel} channel
		 * @param {Object} options = {}
		 * @param {Platform} [options.platform] Platform object, if necessary. Usually used for PMs.
		 * @param {boolean} [options.skipBanphrases] If true, no banphrases will be checked
		 * @param {boolean} [options.skipLengthCheck] If true, length will not be checked
		 * @returns {Promise<String|Boolean>} Returns prepared message, or false if nothing is to be sent (result is ignored)
		 */
		async prepareMessage (message, channel, options = {}) {
			console.warn("Master.prepareMessage is depreacted");
			options.platform = options.platform ?? sb.Channel.get(channel).Platform ?? null;

			return await options.platform.controller.prepareMessage(message, channel, options);
		}
	}

	process.on("uncaughtException", (err) => {
		console.error(err);
		process.abort();
	});

	sb.Master = new Master();
	sb.Platform.assignControllers(sb.Master.controllers);
})();