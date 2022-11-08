/**
 * @param {string} string
 * @returns {Command | null}
 */
const parseCommandName = (string) => {
	const { prefix } = sb.Command;
	return (string.startsWith(prefix) && string.length > prefix.length)
		? sb.Command.get(string.slice(prefix.length))
		: sb.Command.get(string);
};

module.exports = {
	parseCommandName
};
