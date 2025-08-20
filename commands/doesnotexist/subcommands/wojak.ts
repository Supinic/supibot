import type { DoesNotExistSubcommandDefinition } from "../index.js";
import { randomInt } from "../../../utils/command-utils.js";

export default {
	name: "wojak",
	aliases: [],
	title: "Wojak",
	default: false,
	description: [
		`<code>wojak</code> - <a href="https://archive.org/download/thiswojakdoesnotexist.com">This wojak does not exist</a>`
	],
	execute: () => {
		const seed = randomInt(1, 1576);
		const text = `https://archive.org/download/thiswojakdoesnotexist.com/img/${seed}.png`;

		return {
			text,
			reply: `This wojak does not exist: ${text}`
		};
	}
} satisfies DoesNotExistSubcommandDefinition;
