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
				if (platform === "mixer") {
					continue;
					// PepeLaugh eShrug
				}

				/** @type Controller */
				let Controller = null;
				try {
					Controller = require("./controllers/" + platform);
				}
				catch (e) {
					throw new sb.Error({
						message: "Require of " + platform + " controller module failed"
					}, e);
				}

				try {
					this.controllers[platform] = new Controller();
				}
				catch (e) {
					throw new sb.Error({
						message: "Initialization of " + platform + " controller module failed"
					}, e);
				}
			}

			this.started = new sb.Date();
			this.restarted = new sb.Date();
		}

		/**
		 * Reload a given client module - used to hotload edited scripts in runtime with no downtime
		 * @param {Platform} platform Module to reload
		 * @throws {sb.Error} If input module has not been recognized
		 */
		reloadClientModule (platform) {
			const client = sb.Platform.get(platform).Name;

			switch (client) {
				case "cytube":
				case "twitch":
				case "discord":
				case "mixer": {
					const ClientConstructor = this.controllers[client].constructor;

					this.controllers[client] = null;
					this.controllers[client] = new ClientConstructor();
					break;
				}

				default:
					throw new sb.Error({
						message: "Unrecognized module name",
						args: client
					});
			}
		}

		/**
		 * Sends a message to a channel. Does not check any banphrases or character limits
		 * @param {string} message
		 * @param {Channel|Channel.ID|Channel.Name} channel
		 */
		send (message, channel) {
			const channelData = sb.Channel.get(channel);
			const platform = channelData.Platform.Name;
			const client = this.controllers[platform];

			if (!client) {
				return;
			}

			client.send(message, channelData);
		}

		/**
		 * Private messages a user on a given platform.
		 * @param {string} user
		 * @param {string} message
		 * @param {Platform|number|string} platform
		 * @returns {Promise<void>}
		 */
		async pm (user, message, platform) {
			const platformData = sb.Platform.get(platform);
			const client = this.controllers[platformData.Name];
			return client.pm(user, message);
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
			let channelData = null;
			let limit = Infinity;

			if (channel === null) {
				if (!options.platform) {
					throw new sb.Error({
						message: "No platform provided for private messages"
					});
				}

				limit = options.platform.Message_Limit;
				if (options.platform === "twitch") {
					limit -= options.extraLength;
				}
			}
			else {
				channelData = sb.Channel.get(channel);

				// Read-only/Inactive/Nonexistent - do not send anything
				if (!channelData || channelData.Mode === "Read" || channelData.Mode === "Inactive") {
					return false;
				}

				// Remove all links, if the channel requires it
				if (!channelData.Links_Allowed) {
					// replace all links with a placeholder
					message = message.replace(sb.Config.get("LINK_REGEX"), "[LINK]");
				}

				if (!options.skipLengthCheck) {
					limit = channelData.Message_Limit ?? channelData.Platform.Message_Limit;
				}
			}

			message = sb.Utils.wrapString(message, limit);

			// Execute all eligible banphrases, if necessary
			if (!options.skipBanphrases && sb.Banphrase) {
				const { passed, string } = await sb.Banphrase.execute(message, channelData);
				if (!passed) {
					if (options.returnBooleanOnFail) {
						return passed;
					}
				}

				message = string;
			}

			// If the result is not string, do not reply at all.
			if (typeof message !== "string") {
				return false;
			}

			return message;
		}

		/**
		 * Mirrors a message from one channel to another
		 * Mirrored messages should not be prepared in the origin channel, they are checked against the target channel.
		 * Double checking would lead to inconsistent behaviour.
		 * @param {string} message
		 * @param {User} userData
		 * @param {Channel.ID} mirrorID Channel ID to mirror message to
		 * @returns {Promise<void>}
		 */
		async mirror (message, userData, mirrorID) {
			const targetChannel = sb.Channel.get(mirrorID);
			if (!targetChannel) {
				throw new sb.Error({
					message: "Target mirror channel does not exist",
					args: mirrorID
				});
			}
			else if (userData.Name === targetChannel.Platform.Self_Name) {
				// Do not mirror own messages
				return;
			}

			const finalMessage = await this.prepareMessage(message, targetChannel);

			if (finalMessage) {
				this.send(finalMessage, targetChannel);
			}
		}

		async globalMessageListener () {
			// @todo
		}
	}

	process.on("uncaughtException", (err) => {
		console.error(err);
		process.abort();
	});

	sb.Master = new Master();
	sb.Platform.assignControllers(sb.Master.controllers);
})();