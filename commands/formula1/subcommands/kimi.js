const quoteList = require("./kimi.json");
const MAXIMUM_QUOTE_REPEATS = 10;

const repeatedQuotes = {};

module.exports = {
	name: "kimi",
	aliases: ["gimi"],
	description: [
		`<code>$f1 gimi</code>`,
		"Posts a random Kimi Räikkönen quote or radio comms."
	],
	execute: async (context) => {
		const channelID = context.channel?.ID ?? "whispers";
		repeatedQuotes[channelID] ??= [];

		const availableQuotes = quoteList.filter(i => !repeatedQuotes[channelID].includes(i));

		const quote = sb.Utils.randArray(availableQuotes);
		repeatedQuotes[channelID].unshift(quote);
		repeatedQuotes[channelID].splice(MAXIMUM_QUOTE_REPEATS);

		return {
			reply: quote
		};
	}
};
