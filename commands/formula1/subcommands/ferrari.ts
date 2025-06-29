import radios from "./ferrari.json" with { type: "json" };
import type { FormulaOneSubcommandDefinition } from "../index.js";
import type { Channel } from "../../../classes/channel.js";

const MAXIMUM_QUOTE_REPEATS = 10;
const repeatedQuotes: Map<Channel["ID"] | "whispers", string[]> = new Map();

export default {
	name: "ferrari",
	aliases: ["ferari"],
	title: "Ferrari radios",
	default: false,
	description: [
		`<code>$f1 ferrari</code>`,
		"Posts a random Ferrari radio quote."
	],
	execute: (context) => {
		const channelID = context.channel?.ID ?? "whispers";
		let repeatedArray = repeatedQuotes.get(channelID);
		if (!repeatedArray) {
			repeatedArray = [];
			repeatedQuotes.set(channelID, repeatedArray);
		}

		const availableQuotes = radios.filter(i => !repeatedArray.includes(i));
		const quote = core.Utils.randArray(availableQuotes);

		repeatedArray.unshift(quote);
		repeatedArray.splice(MAXIMUM_QUOTE_REPEATS);

		return {
			success: true,
			reply: quote
		};
	}
} satisfies FormulaOneSubcommandDefinition;
