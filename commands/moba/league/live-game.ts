import { SupiDate, SupiError } from "supi-core";

import { type MobaSubcommandDefinition } from "../index.js";
import {
	parseUserIdentifier,
	getQueueDescription,
	getLiveMatchData,
	getChampionData,
	invalidateChampionCache,
	type ChampionData
} from "./utils.js";

const getChampionName = (data: ChampionData[], id: number): string => {
	const champion = data.find(i => i.key === id);
	if (!champion) {
		void invalidateChampionCache();
		throw new SupiError({
			message: `Assert error: Champion ID ${id} does not exist`
		});
	}

	return champion.name;
};

export default {
	name: "liveGame",
	title: "Last played match",
	aliases: ["live", "live-game"],
	description: [
		"<code>$league live (region) (username)</code>",
		"<code>$league live EUW Username#Tag</code>",
		"Fetches quick data about the current match the given player is in."
	],
	default: false,
	flags: {
		default: false
	},
	execute: async (context, type, regionName, ...args) => {
		const leagueUser = await parseUserIdentifier(context, regionName, args.join(" "));
		if (!leagueUser.success) {
			return leagueUser;
		}

		const { puuid, region } = leagueUser;
		const playerName = leagueUser.gameName;
		const liveData = await getLiveMatchData(region, puuid);
		if (!liveData.success) {
			return liveData;
		}

		const { gameQueueConfigId, gameStartTime, participants } = liveData.data;
		const player = participants.find(i => i.puuid === puuid);
		if (!player) {
			return {
				success: false,
				reply: "Could not find target user in match! They likely have streamer mode turned on."
			};
		}

		const championData = await getChampionData();
		const gameQueue = await getQueueDescription(gameQueueConfigId);
		const gameType = gameQueue.shortName ?? "(unknown)";

		const alliedTeam = [];
		const enemyTeam = [];
		for (const participant of participants) {
			if (participant.puuid === puuid) {
				continue; // self user
			}

			const championName = getChampionName(championData, participant.championId);
			if (participant.teamId === player.teamId) {
				alliedTeam.push(championName);
			}
			else {
				enemyTeam.push(championName);
			}
		}

		const playerChampion = getChampionName(championData, player.championId);
		const duration = core.Utils.timeDelta(gameStartTime, true, false, new SupiDate());
		return {
			success: true,
			reply: `
				${playerName} is playing ${playerChampion} in ${gameType} for ${duration}.
				Ally team: ${alliedTeam.join(", ")}.
				Enemy team: ${enemyTeam.join(", ")}.
			`
		};
	}
} satisfies MobaSubcommandDefinition;
