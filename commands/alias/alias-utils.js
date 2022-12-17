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

/**
 * @param {string} string
 * @returns {string | null}
 */
const parseInvocationName = (string) => {
	const { prefix } = sb.Command;
	return (string.startsWith(prefix) && string.length > prefix.length)
		? string.slice(prefix.length)
		: string;
};

const isRestricted = (type, aliasData) => aliasData.Restrictions.includes(type);

module.exports = {
	isRestricted,
	parseCommandName,
	parseInvocationName
};
