import { lines } from "./forsenE.json";

const MAXIMUM_REPEATS = 5;
const previousLines = [];

export default {
	Name: "forsenE",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "Posts a random forsenE tweet.",
	Flags: ["pipe"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function forsenE (context) {
		const eligibleLines = lines.filter(i => !previousLines.includes(i));
		const line = sb.Utils.randArray(eligibleLines);

		previousLines.unshift(line);
		previousLines.splice(MAXIMUM_REPEATS);

		return {
			reply: `${line} ${context.invocation}`
		};
	}),
	Dynamic_Description: null
};
