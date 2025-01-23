import copypastaList from "./copypasta.json" with { type: "json" };
const MAXIMUM_COPYPASTA_REPEATS = 10;

const repeatedPastas = {};

export default {
	name: "copypasta",
	aliases: [],
	description: [
		`<code>$f1 copypasta</code>`,
		"Posts a random Formula 1 related copypasta."
	],
	execute: async (context) => {
		const channelID = context.channel?.ID ?? "whispers";
		repeatedPastas[channelID] ??= [];

		const availablePastas = copypastaList.filter(i => !repeatedPastas[channelID].includes(i));
		const pasta = sb.Utils.randArray(availablePastas);

		repeatedPastas[channelID].unshift(pasta);
		repeatedPastas[channelID].splice(MAXIMUM_COPYPASTA_REPEATS);

		return {
			reply: pasta
		};
	}
};
