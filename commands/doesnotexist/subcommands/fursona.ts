import type { DoesNotExistSubcommandDefinition } from "../index.js";
import { randomInt } from "../../../utils/command-utils.js";

export default {
	name: "fursona",
	aliases: [],
	title: "Fursona",
	default: false,
	description: [
		`<code>fursona</code> - <a href="https://thisfursonadoesnotexist.com/">This fursona does not exist</a>`
	],
	execute: () => {
		const number = randomInt(1, 99999);
		const padded = core.Utils.zf(number, 5);

		const text = `https://thisfursonadoesnotexist.com/v2/jpgs-2x/seed${padded}.jpg`;
		return {
			text,
			reply: `This fursona does not exist: ${text}`
		};
	}
} satisfies DoesNotExistSubcommandDefinition;
