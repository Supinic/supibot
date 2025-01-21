const {
	NON_STANDARD_CHAMPION_NAMES,
	parseUserIdentifier,
	getMatchIds,
	getMatchData,
	getQueueDescription,
	TEAM_POSITIONS_MAP
} = require("./utils.js");

module.exports = {
	name: "lastMatch",
	aliases: ["last"],
	description: [
		"<code>$league last (region) (username)</code>",
		"<code>$league last EUW Username#Tag</code>",
		"Fetches quick data about the last match a given user has played (or is currently playing)."
	],
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
		const matchIds = await getMatchIds(region, puuid, { count: 1 });
		if (matchIds.length === 0) {
			return {
				success: false,
				reply: `That user has not played any games recently!`
			};
		}

		const { info } = await getMatchData(region, matchIds[0]);
		const player = info.participants.find(i => i.puuid === puuid);
		const gameQueue = await getQueueDescription(info.queueId);

		if (context.params.rawData) {
			return {
				reply: "Data is available.",
				data: {
					game: {
						duration: info.gameDuration,
						mode: info.gameMode,
						id: info.gameId,
						type: info.gameType,
						version: info.gameVersion
					},
					queue: gameQueue,
					player
				}
			};
		}

		const gameEnd = new sb.Date(info.gameEndTimestamp);
		const gameEndString = `Played ${sb.Utils.timeDelta(gameEnd)}`;
		const gameResultString = (player.win) ? "won as" : "lost as";
		const gameLengthMinutes = Math.floor(info.gameDuration / 60);
		const gameLengthString = `in ${gameLengthMinutes}min`;

		const creepScore = player.totalMinionsKilled + player.neutralMinionsKilled;
		const creepsPerMinute = sb.Utils.round(creepScore / gameLengthMinutes, 1);

		const position = TEAM_POSITIONS_MAP[player.teamPosition] ?? "(unknown)";
		const gameType = gameQueue.shortName;

		const champName = NON_STANDARD_CHAMPION_NAMES[player.championName] ?? player.championName;
		return {
			reply: sb.Utils.tag.trim `
				${playerName} ${gameResultString} ${champName} ${position}
				in ${gameType} ${gameLengthString}.	
				KDA: ${player.kills}/${player.deaths}/${player.assists},
				${creepScore} CS (${creepsPerMinute} CS/min).
				${gameEndString}
			 `
		};
	}
};
