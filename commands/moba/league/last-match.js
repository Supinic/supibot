const {
	GAME_RESULT,
	NON_STANDARD_CHAMPION_NAMES,
	parseUserIdentifier,
	getMatchIds,
	getMatchData
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

		const { puuid, gameName } = leagueUser;
		const matchIds = await getMatchIds(puuid, { count: 1 });
		if (matchIds.length === 0) {
			return {
				success: false,
				reply: `That user has not played any games recently!`
			};
		}

		const { info } = await getMatchData(matchIds[0]);

		let gameStateString = "is currently playing";
		let gameEndString = "";
		let gameResultString = "";

		const player = info.participants.find(i => i.puuid === puuid);
		if (info.endOfGameResult === GAME_RESULT.END || info.gameEndTimestamp) {
			const gameEnd = new sb.Date(info.gameEndTimestamp);

			gameEndString = `(game ended ${sb.Utils.timeDelta(gameEnd)})`;
			gameStateString = `last played`;
			gameResultString = (player.win) ? "and won" : "and lost";
		}

		// @todo include type of game (flex, ranked, aram, ...)

		const champName = NON_STANDARD_CHAMPION_NAMES[player.championName] ?? player.championName;
		return {
			reply: sb.Utils.tag.trim `
				${gameName} ${gameStateString} ${champName}		
				${gameResultString}	
				with KDA of ${player.kills}/${player.deaths}/${player.assists}.	
				${gameEndString}
			 `
		};
	}
};
