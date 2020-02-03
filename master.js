/* global sb */
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
	await require("supinic-globals")("sb");

	const EventEmitter = require("events");
	const options = {
		twitch: {
			url: "irc.chat.twitch.tv",
			port: 6667,
			nick: sb.Config.get("SELF"),
			username: sb.Config.get("TWITCH_USERNAME"),
			pass: sb.Config.get("TWITCH_OAUTH")
		},
		discord: {
			name: sb.Config.get("DISCORD_SELF"),
		},
		cytube: [{
			host: "cytu.be",
			secure: true,
			user: sb.Config.get("CYTUBE_SELF"),
			auth: sb.Config.get("CYTUBE_BOT_PASSWORD"),
			chan: "forsenoffline",
		}]
	};

	/**
	 * Master client instance.
	 * Holds control over all clients.
	 * @type Master
	 * @extends EventEmitter
	 */
	class Master {
		constructor () {
			this.started = new sb.Date();
			this.reloaded = new sb.Date();

			this.flags = {};
			this.data = {};

			this.clientClasses = {
				cytube: require("./clients/cytube.js"),
				discord: require("./clients/discord.js"),
				twitch: require("./clients/twitch.js"),
				mixer: require("./clients/mixer.js")
			};

			this.clients = {
				cytube: options.cytube.map(channel => new this.clientClasses.cytube(channel)),
				discord: new this.clientClasses.discord(options.discord),
				twitch: new this.clientClasses.twitch(this, options.twitch),
				mixer: new this.clientClasses.mixer(this, options.mixer),
			};
		}

		/**
		 * Reload a given client module - used to hotload edited scripts in runtime with no downtime
		 * @param {string} mod Module to reload
		 * @param {boolean} [hard] If true, also reloads the require cache
		 * @throws {sb.Error} If input module has not been recognized
		 */
		reloadClientModule (mod, hard) {
			mod = mod.toLowerCase();
			switch (mod) {
				case "cytube":
				case "twitch":
				case "discord":
					this.clients[mod] = null;

					if (hard) {
						this.clientClasses[mod] = null;
						delete require.cache[require.resolve("./clients/" + mod + ".js")];
						this.clientClasses[mod] = require("./clients/" + mod + ".js");
					}

					this.clients[mod] = new this.clientClasses[mod](this, options[mod]);
					break;

				default:
					throw new sb.Error({
						message: "Unrecognized module name",
						args: mod
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
			const client = this.clients[platform];

			if (!client) {
				return;
			}

			if (platform === "cytube") {
				if (!client.find) {
					return;
				}

				const target = client.find(i => i.channelData.ID === channelData.ID);
				if (!target) {
					return;
				}

				target.send(message);
			}
			else {
				client.send(message, channelData);
			}
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
			const client = this.clients[platformData.Name];
			return await client.pm(user, message);
		}

		/**
		 * Prepares a message to be sent in the provided channel.
		 * Checks banphrases, respects length limits.
		 * Ignores if channel is inactive or read-only
		 * @param {string} message
		 * @param {Channel} channel
		 * @param {Object} options = {}
		 * @param {boolean} [options.skipBanphrases] If true, no banphrases will be checked
		 * @param {boolean} [options.skipLengthCheck] If true, length will not be checked
		 * @returns {Promise<String|Boolean>} Returns prepared message, or false if nothing is to be sent (result is ignored)
		 */
		async prepareMessage (message, channel, options = {}) {
			let platform = null;
			let channelData = {};
			let limit = Infinity;

			if (channel === null) {
				if (!options.platform) {
					throw new sb.Error({
						message: "No platform provided for a null channel (most likely private messages)"
					});
				}

				limit = sb.Config.get("DEFAULT_MSG_LIMIT_" + options.platform.toUpperCase());
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

				platform = channelData.Platform.Name;
				if (!options.skipLengthCheck) {
					limit = channelData.Message_Limit || sb.Config.get("DEFAULT_MSG_LIMIT_" + platform.toUpperCase());
				}
			}

			message = sb.Utils.wrapString(message, limit);

			// Execute all eligible banphrases, if necessary
			if (!options.skipBanphrases && sb.Banphrase) {
				const {string, passed} = await sb.Banphrase.execute(message, channelData);

				if (!passed) {
					sb.SystemLogger.send("Message.Ban", "(" + string + ") => (" + message + ")", channelData);
					if (options.returnBooleanOnFail) {
						return passed;
					}
				}

				message = string;
			}

			// False -> request do not reply at all
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
			// Do not mirror own messages
			if (userData.Name === sb.Config.get("SELF")) {
				return;
			}

			const targetChannel = sb.Channel.get(mirrorID);
			if (!targetChannel) {
				throw new sb.Error({
					message: "Target mirror channel does not exist",
					args: mirrorID
				});
			}

			message = await this.prepareMessage(message, targetChannel);
			if (message) {
				setTimeout(() => this.send(message, targetChannel), sb.Config.get("MIRROR_DELAY"));
			}
		}

		/**
		 * @returns {string} Global command prefix.
		 */
		get commandPrefix () { return sb.Config.get("COMMAND_PREFIX"); }
	}

	process.on("uncaughtException", () => process.kill(process.pid));

	sb.Master = new Master();
})();