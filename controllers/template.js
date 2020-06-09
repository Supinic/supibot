/* eslint-disable no-unused-vars */
/**
 * @name {Controller}
*/
module.exports = class Controller {
	initListeners () { }

	async send (message, channel) { }

	async pm (message, user) { }

	async handleCommand () { }

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