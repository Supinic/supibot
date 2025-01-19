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

/**
 * Determines whether an alias is restricted from being copied or linked.
 * @param type
 * @param aliasData
 * @return {boolean}
 */
const isRestricted = (type, aliasData) => (aliasData.Restrictions ?? []).includes(type);

const applyParameters = (context, aliasArguments, commandArguments) => {
	let errorReason;
	const resultArguments = [];
	const numberRegex = /(?<order>-?\d+)(\.\.(?<range>-?\d+))?(?<rest>\+?)/;
	const strictNumberRegex = /^[\d-.+]+$/;

	for (let i = 0; i < aliasArguments.length; i++) {
		const parsed = aliasArguments[i].replaceAll(/\${(.+?)}/g, (total, match) => {
			const numberMatch = match.match(numberRegex);
			if (numberMatch && strictNumberRegex.test(match)) {
				let order = Number(numberMatch.groups.order);
				if (order < 0) {
					order = commandArguments.length + order;
				}

				let range = (numberMatch.groups.range) ? Number(numberMatch.groups.range) : null;
				if (typeof range === "number") {
					if (range < 0) {
						range = commandArguments.length + range + 1;
					}

					if (range < order) {
						const temp = range;
						range = order;
						order = temp;
					}
				}

				const useRest = (numberMatch.groups.rest === "+");
				if (useRest && range) {
					errorReason = `Cannot combine both the "range" (..) and "rest" (+) argument symbols!`;
				}
				else if (useRest) {
					return commandArguments.slice(order).join(" ");
				}
				else if (range) {
					return commandArguments.slice(order, range).join(" ");
				}
				else {
					return commandArguments[order] ?? "";
				}
			}
			else if (match === "executor") {
				return context.user.Name;
			}
			else if (match === "channel") {
				return context.channel?.Description ?? context.channel?.Name ?? "[private messages]";
			}
			else {
				return total;
			}
		});

		if (errorReason) {
			return {
				success: false,
				reply: errorReason
			};
		}

		resultArguments.push(...parsed.split(" "));
	}

	return {
		success: true,
		resultArguments
	};
};

module.exports = {
	applyParameters,
	isRestricted,
	parseCommandName,
	parseInvocationName
};
