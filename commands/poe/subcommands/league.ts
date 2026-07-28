import * as z from "zod";
import { SupiDate } from "supi-core";
import rawPoe1Data from "./poe1.json" with { type: "json" };
import rawPoe2Data from "./poe2.json" with { type: "json" };
import type { PathOfExileSubcommandDefinition } from "../index.js";

const leagueShape = z.object({
	patch: z.string(),
	name: z.string().nullable(),
	reveal: z.string().nullable(),
	launch: z.string(),
	end: z.string().nullable()
});
const dataShape = z.object({
	leagues: z.array(leagueShape)
});

const GAME_LEAGUES = {
	poe: dataShape.parse(rawPoe1Data).leagues,
	poe2: dataShape.parse(rawPoe2Data).leagues
} as const;
const formatLeagueName = (league: z.infer<typeof leagueShape>): string => (
	(league.name) ? `${league.patch} ${league.name}` : league.patch
);

export default {
	name: "league",
	title: "Current leagues",
	default: true,
	aliases: [],
	description: [],
	getDescription: (prefix) => [
		"Posts data about the upcoming or current league.",
		"",

		`<code>${prefix}poe</code>`,
		"Posts info about the current PoE 1 league, with info about the upcoming league if available.",
		"",

		`<code>${prefix}poe2</code>`,
		"Posts info about the current PoE 2 league, with info about the upcoming league if available."
	],
	execute: (context) => {
		// @todo remove this type cast when context.invocation is a specific union in the future
		const invocation = context.invocation as "poe" | "poe2";
		const leagues = GAME_LEAGUES[invocation];

		const result = [];
		const now = SupiDate.now();
		const currentLeague = leagues.find(i => i.end && new SupiDate(i.end).valueOf() > now);
		if (currentLeague && currentLeague.end) {
			const endDate = new SupiDate(currentLeague.end);
			result.push(`The ${formatLeagueName(currentLeague)} league will end ${core.Utils.timeDelta(endDate)}.`);
		}

		const nextLeague = (currentLeague)
			? leagues.find(i => !i.end && new SupiDate(i.launch).valueOf() > now)
			: leagues.find(i => !i.end || new SupiDate(i.end).valueOf() > now);

		if (nextLeague) {
			const { reveal, launch } = nextLeague;
			const name = formatLeagueName(nextLeague);
			const revealDate = (reveal) ? new SupiDate(reveal) : null;
			const launchDate = new SupiDate(launch);

			if (revealDate && revealDate.valueOf() > now) {
				result.push(`The ${formatLeagueName(nextLeague)} league will be revealed ${core.Utils.timeDelta(revealDate)}.`);
			}
			else if (launchDate.valueOf() > now) {
				result.push(`The ${name} league will start ${core.Utils.timeDelta(launchDate)}.`);
			}
			else if (invocation === "poe") { // Only apply the 4 months runtime estimate for PoE 1 leagues (for now)
				const possibleEnd = launchDate.clone().addMonths(4);
				if (possibleEnd.valueOf() > now) {
					const delta = core.Utils.timeDelta(possibleEnd, true);
					result.push(`The ${name} league has launched - go and play. It will last for roughly ${delta}.`);
				}
				else {
					result.push(`The ${name} league has likely concluded. Ask @Supinic to add new info about the next league!`);
				}
			}
		}

		return {
			success: true,
			reply: result.join(" ")
		};
	}
} satisfies PathOfExileSubcommandDefinition;
