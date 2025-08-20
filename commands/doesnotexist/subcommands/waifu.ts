import type { DoesNotExistSubcommandDefinition } from "../index.js";
import { randomInt } from "../../../utils/command-utils.js";

export default {
	name: "waifu",
	aliases: [],
	title: "Waifu",
	default: false,
	description: [
		`<code>waifu</code> - <a href="https://thiswaifudoesnotexist.net/">This waifu does not exist</a>`
	],
	execute: () => {
		const seed = randomInt(1, 1e5);
		const text = `https://www.thiswaifudoesnotexist.net/example-${seed}.jpg`;

		return {
			text,
			reply: `This anime does not exist: ${text}`
		};
	}
} satisfies DoesNotExistSubcommandDefinition;
