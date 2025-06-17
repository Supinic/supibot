import forsenData from "./forsenE.json" with { type: "json" };

const MAXIMUM_REPEATS = 5;
const previousLines = [];

export default {
	Name: "forsenE",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "Posts a random forsenE tweet.",
	Flags: ["pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function forsenE (context) {
		const eligibleLines = forsenData.lines.filter(i => !previousLines.includes(i));
		const line = core.Utils.randArray(eligibleLines);

		previousLines.unshift(line);
		previousLines.splice(MAXIMUM_REPEATS);

		return {
			reply: `${line} ${context.invocation}`
		};
	}),
	Dynamic_Description: null
};
