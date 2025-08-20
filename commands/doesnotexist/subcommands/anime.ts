import type { DoesNotExistSubcommandDefinition } from "../index.js";
import { randomInt } from "../../../utils/command-utils.js";

export default {
	name: "anime",
	aliases: [],
	title: "Anime",
	default: false,
	description: [
		`<code>anime</code> - <a href="https://thisanimedoesnotexist.ai/">This anime does not exist</a>`,
		"Supports the <code>summary</code> parameter - will give you a link to many variations of the same image"
	],
	execute: (context) => {
		if (context.params.summary) {
			const seed = randomInt(10000, 99999);
			const text = `https://thisanimedoesnotexist.ai/slider.html?seed=${seed}`;

			return {
				text,
				reply: `This anime summary does not exist: ${text}`
			};
		}
		else {
			const id = randomInt(10000, 99999);
			const creativity = randomInt(3, 20);
			const psi = (creativity / 10).toFixed(1);

			const text = `https://thisanimedoesnotexist.ai/results/psi-${psi}/seed${id}.png`;
			return {
				text,
				reply: `This anime does not exist: ${text}`
			};
		}
	}
} satisfies DoesNotExistSubcommandDefinition;
