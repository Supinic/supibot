import { randomInt } from "../../utils/command-utils.js";

const MAXIMUM_EMOJI_LIMIT = 50;
const EMOJI_RANGES = [
	[0x1F300, 0x1F5FF],
	[0x1F600, 0x1F64F],
	[0x1F680, 0x1F6FF],
	[0x1F910, 0x1F9FF]
];

const isEmojiRegex = /\p{Emoji}/u;
const generateEmoji = () => {
	const range = sb.Utils.randArray(EMOJI_RANGES);

	let string = "";
	let attempts = 5;
	while (!isEmojiRegex.test(string) && attempts > 0) {
		const point = randomInt(range[0], range[1]);
		string = String.fromCodePoint(point);
		attempts--;
	}

	if (attempts <= 0) {
		string = String.fromCodePoint(range[0]);
	}

	return string;
};

export default {
	Name: "randomemoji",
	Aliases: ["re"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Fetches a random emoji. If a number is provided, rolls that many emojis.",
	Flags: ["pipe"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function randomEmoji (context, number = 1) {
		let repeats = Number(number);
		if (!sb.Utils.isValidInteger(repeats) || repeats > MAXIMUM_EMOJI_LIMIT) {
			repeats = 1;
		}

		const result = [];
		for (let i = 0; i < repeats; i++) {
			result.push(generateEmoji());
		}

		return {
			reply: result.join(" ")
		};
	}),
	Dynamic_Description: () => [
		`Returns a random emoji from several pre-determined emoji ranges.`,
		`Maximum amount of emojis per command: ${MAXIMUM_EMOJI_LIMIT}`,
		"",

		`<code>$re</code>`,
		"(one random emoji)",
		"",

		`<code>$re 10</code>`,
		"(ten random emojis)",
		""
	]
};
