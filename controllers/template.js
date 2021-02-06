/* eslint-disable no-unused-vars */
/**
 * @name {Controller}
*/
module.exports = class Controller {
	data = {
		crons: []
	};

	initListeners () { }

	async send (message, channel) { }

	async pm (message, user) { }

	async handleCommand () { }

	resolveUserMessage (channelData, userData, message) {
		if (!this.platform?.userMessagePromises) {
			return;
		}

		const channelMap = this.platform.userMessagePromises.get(channelData);
		if (channelMap && channelMap.has(userData)) {
			const { promise, timeout } = channelMap.get(userData);

			clearTimeout(timeout);
			channelMap.delete(userData);
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
	 * @param {boolean} commandUsed = false If a command was used, do not include the user name of who issued the command.
	 * @returns {Promise<void>}
	 */
	async mirror (message, userData, channelData, commandUsed = false) {
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

		const fixedMessage = (commandUsed)
			? `${symbol} ${message}`
			: `${symbol} ${userData.Name}: ${message}`;

		const finalMessage = await sb.Master.prepareMessage(fixedMessage, mirrorChannelData);
		if (finalMessage) {
			await mirrorChannelData.send(finalMessage);
		}
	}

	fetchUserList () {
		throw new sb.Error({
			message: "Method not implemented"
		});
	}
	
	restart () { }

	destroy () { }
};