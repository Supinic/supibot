import type { OsrsSubcommandDefinition } from "../index.js";
import { fetchPlayerCount } from "./osrs-utils.js";

// let previousPlayerCount: number | null = null;
// let previousTimestamp: number | null = null;

export default {
	name: "playercount",
	title: "Online player count",
	aliases: ["pc"],
	default: false,
	description: [],
	getDescription: (prefix) => [
		`<code>${prefix}osrs playercount</code>`,
		"Fetches the current amount of players online for OSRS",
		"This command will not work when the website is down due to an update or otherwise",
		`You can check the player count yourself on the <a href="//oldschool.runescape.com/slu">official Jagex website</a> (at the top)`
	],
	execute: async function () {
		const playerCount = await fetchPlayerCount();
		if (!playerCount) {
			// const appendix = (previousPlayerCount) ? ` Last recorded number: ${previousPlayerCount}` : "";
			return {
			    success: false,
			    reply: `The number of players online is not currently available!`
			};
		}

		// let appendix = "";
		// if (previousPlayerCount) {
		// 	const delta = Math.abs(playerCount - previousPlayerCount);
		// 	const sign = (playerCount < previousPlayerCount) ? "-" : "+";
		//
		// 	appendix = ` Change: ${sign}${delta}`;
		// }
		//
		// previousPlayerCount = playerCount;

		const formattedCount = core.Utils.groupDigits(playerCount);
		return {
		    success: true,
		    reply: `Currently online players: ${formattedCount}.`
		};
	}
} satisfies OsrsSubcommandDefinition;
