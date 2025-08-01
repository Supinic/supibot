import type { FormulaOneSubcommandDefinition } from "../index.js";
import type { Channel } from "../../../classes/channel.js";

import quoteList from "./kimi.json" with { type: "json" };

const MAXIMUM_QUOTE_REPEATS = 10;
const repeatedQuotes: Map<Channel["ID"] | "whispers", string[]> = new Map();

export default {
	name: "kimi",
	aliases: ["gimi"],
	title: "Kimi quote",
	default: false,
	description: [
		`<code>$f1 gimi</code>`,
		"Posts a random Kimi Räikkönen quote or radio comms."
	],
	execute: (context) => {
		const channelID = context.channel?.ID ?? "whispers";
		let repeatedArray = repeatedQuotes.get(channelID);
		if (!repeatedArray) {
			repeatedArray = [];
			repeatedQuotes.set(channelID, repeatedArray);
		}

		const availableQuotes = quoteList.filter(i => !repeatedArray.includes(i));
		const quote = core.Utils.randArray(availableQuotes);

		repeatedArray.unshift(quote);
		repeatedArray.splice(MAXIMUM_QUOTE_REPEATS);

		return {
			success: true,
			reply: quote
		};
	}
} satisfies FormulaOneSubcommandDefinition;
