const {
	GAME_RESULT,
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

		const { puuid, region, gameName } = leagueUser;
		const matchIds = await getMatchIds(region, puuid, { count: 1 });
		if (matchIds.length === 0) {
			return {
				success: false,
				reply: `That user has not played any games recently!`
			};
		}

		const { info } = await getMatchData(region, matchIds[0]);

		let gameStateString = "is currently playing";
		let gameEndString = "";
		let gameResultString = "";

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

		if (info.endOfGameResult === GAME_RESULT.END || info.gameEndTimestamp) {
			const gameEnd = new sb.Date(info.gameEndTimestamp);

			gameEndString = `(game ended ${sb.Utils.timeDelta(gameEnd)})`;
			gameStateString = `last played`;

			const gameResult = (player.win) ? "and won" : "and lost";
			const gameLength = sb.Utils.formatTime(info.gameDuration, true);

			gameResultString = `${gameResult} in ${gameLength}`;
		}

		const { challenges } = player;
		const creepScore = player.totalMinionsKilled + player.neutralMinionsKilled;
		const creepsBefore10Minutes = challenges.laneMinionsFirst10Minutes + challenges.jungleCsBefore10Minutes;
		const position = TEAM_POSITIONS_MAP[player.teamPosition] ?? "(unknown)";

		const gameType = gameQueue.description.replace(/\s*games\s*$/i, "");

		const champName = NON_STANDARD_CHAMPION_NAMES[player.championName] ?? player.championName;
		return {
			reply: sb.Utils.tag.trim `
				${gameName} ${gameStateString} ${champName} ${position}
				in ${gameType}
				${gameResultString}	
				with KDA of ${player.kills}/${player.deaths}/${player.assists},
				with a CS of ${creepScore} (${creepsBefore10Minutes} in the first 10min).
				${gameEndString}
			 `
		};
	}
};
