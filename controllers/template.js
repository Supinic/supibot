/**
 * @name {Controller}
*/
module.exports = class Controller {
	initListeners () { }

	send (message, channelData) { }

	pm (user, message) { }

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