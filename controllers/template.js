/* eslint-disable no-unused-vars */
/**
 * @name {Controller}
*/
module.exports = class Controller {
	data = {
		crons: []
	};

	initListeners () {}

	async send (message, channel) {}

	async pm (message, user) {}

	async handleCommand () {}

	/**
	 * Resolves a registered awaiting message.
	 * @param {Channel|null} channelData
	 * @param {User} userData
	 * @param {string} message
	 */
	resolveUserMessage (channelData, userData, message) {
		if (!this.platform?.userMessagePromises) {
			return;
		}

		const channelIdentifier = channelData?.ID ?? null;
		const channelMap = this.platform.userMessagePromises.get(channelIdentifier);
		if (channelMap && channelMap.has(userData.ID)) {
			const { promise, timeout } = channelMap.get(userData.ID);

			clearTimeout(timeout);
			channelMap.delete(userData.ID);
			promise.resolve({ message });
		}
	}

	/**
	 * Mirrors a message from one channel to another
	 * Mirrored messages should not be prepared in the origin channel, they are checked against the target channel.
	 * Double checking would lead to inconsistent behaviour.
	 * @param {string} message
	 * @param {User} userData
	 * @param {Channel} channelData The channel where the message is coming from
	 * @param {Object} [options]
	 * @param {boolean} [options.commandUsed] = false If a command was used, do not include the user name of who issued the command.
	 * @returns {Promise<void>}
	 */
	async mirror (message, userData, channelData, options = {}) {
		const mirrorChannelData = sb.Channel.get(channelData.Mirror);
		if (!mirrorChannelData) {
			console.warn("Provided channel does not have any mirror channel set up", { channelData });
			return;
		}

		// Do not mirror if no identifier has been configured
		const symbol = this.platform.Mirror_Identifier;
		if (symbol === null) {
			return;
		}

		// Do not mirror own messages
		if (userData.Name === channelData.Platform.Self_Name) {
			return;
		}

		const fixedMessage = (options.commandUsed)
			? `${symbol} ${message}`
			: `${symbol} ${userData.Name}: ${message}`;

		const { controller } = mirrorChannelData.Platform;
		const finalMessage = await controller.prepareMessage(fixedMessage, mirrorChannelData, options);

		if (finalMessage) {
			try {
				await mirrorChannelData.send(finalMessage);
			}
			catch (e) {
				return {
					error: e,
					success: false
				};
			}
		}

		return {
			success: true
		};
	}

	fetchUserList () {
		throw new sb.Error({
			message: "Method not implemented"
		});
	}

	/**
	 * Returns a list of usable emotes in the scope of the provided channel.
	 * @param {Channel} channelData
	 * @returns {Promise<TypedEmote[]>}
	 */
	async fetchChannelEmotes (channelData) { return []; }

	/**
	 * Returns a list of usable emotes in the scope of entire platform.
	 * @returns {Promise<TypedEmote[]>}
	 */
	async fetchGlobalEmotes () { return []; }

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
	 * @param {boolean} [options.keepWhitespace] If true, whitespace will not be stripped
	 * @returns {Promise<String|Boolean>} Returns prepared message, or false if nothing is to be sent (result is ignored)
	 */
	async prepareMessage (message, channel, options = {}) {
		let channelData = null;
		let limit = Infinity;

		if (channel !== null) {
			channelData = sb.Channel.get(channel);

			// Read-only/Inactive/Nonexistent - do not send anything
			if (!channelData || channelData.Mode === "Read" || channelData.Mode === "Inactive") {
				return false;
			}

			// Remove all links, if the channel requires it - replace all links with a placeholder
			if (channelData.Links_Allowed === false) {
				message = sb.Utils.replaceLinks(message, "[LINK]");
			}

			if (!options.skipLengthCheck) {
				limit = channelData.Message_Limit ?? channelData.Platform.Message_Limit;
			}
		}

		message = sb.Utils.wrapString(message, limit, {
			keepWhitespace: Boolean(options.keepWhitespace)
		});

		// Execute all eligible banphrases, if necessary
		if (!options.skipBanphrases && sb.Banphrase) {
			const { passed, string } = await sb.Banphrase.execute(message, channelData);
			if (!passed && options.returnBooleanOnFail) {
				return passed;
			}

			message = string;
		}

		// If the result is not string, do not reply at all.
		if (typeof message !== "string") {
			return false;
		}

		return message;
	}

	restart () {}

	destroy () {}
};

/**
 * @typedef {Object} TypedEmote Describes any emote
 * @property {string} ID
 * @property {string} name
 * @property {string} type
 * @property {boolean} global
 * @property {boolean} animated
 */
