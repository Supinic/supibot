/* eslint-disable no-unused-vars */
/**
 * @name {Controller}
*/
module.exports = class Controller {
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

	mirror (message, userData, channelData, commandUsed = false) {
		const symbol = this.platform.Mirror_Identifier;
		if (symbol === null) {
			return;
		}

		const fixedMessage = (commandUsed)
			? `${symbol} ${message}`
			: `${symbol} ${userData.Name}: ${message}`;

		sb.Master.mirror(fixedMessage, userData, channelData.Mirror);
	}

	restart () { }

	destroy () { }
};