import { formulaOneBinding } from "../index.js";
import copypastaList from "./copypasta.json" with { type: "json" };
import type { Channel } from "../../../classes/channel.js";

const MAXIMUM_COPYPASTA_REPEATS = 10;

const repeatedPastas: Map<Channel["ID"] | "whispers", string[]> = new Map();
export const asdf = formulaOneBinding({
	name: "copypasta",
	aliases: [],
	description: [
		`<code>$f1 copypasta</code>`,
		"Posts a random Formula 1 related copypasta."
	],
	execute: (context) => {
		const channelID = context.channel?.ID ?? "whispers";
		let repeatedArray = repeatedPastas.get(channelID);
		if (!repeatedArray) {
			repeatedArray = [];
			repeatedPastas.set(channelID, repeatedArray);
		}

		const availablePastas = copypastaList.filter(i => !repeatedArray.includes(i));
		const pasta = core.Utils.randArray(availablePastas);

		repeatedArray.unshift(pasta);
		repeatedArray.splice(MAXIMUM_COPYPASTA_REPEATS);

		return {
			success: true,
			reply: pasta
		};
	}
});
