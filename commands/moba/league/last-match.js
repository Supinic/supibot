const {
	GAME_RESULT,
	NON_STANDARD_CHAMPION_NAMES,
	getPUUIDByName,
	getMatchIds,
	getPlatform,
	getMatchData
} = require("./utils.js");

module.exports = {
	name: "lastMatch",
	aliases: ["last"],
	description: [
		"TODO"
	],
	flags: {
		default: false
	},
	execute: async (context, type, regionName, ...args) => {
		const userIdentifier = args.join(" ");
		if (!regionName || !userIdentifier) {
			return {
				success: false,
				reply: `You must provide the region and the full user name!`
			};
		}

		const region = getPlatform(regionName);
		if (!region) {
			return {
				success: false,
				reply: `Invalid region provided!`
			};
		}

		let gameName;
		let tagLine;
		if (userIdentifier.includes("#")) {
			[gameName, tagLine] = userIdentifier.split("#");
		}
		else {
			gameName = userIdentifier;
			tagLine = regionName;
		}

		const puuid = await getPUUIDByName(gameName, tagLine);
		if (!puuid) {
			return {
				success: false,
				reply: `No such user exists!`
			};
		}

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
		if (info.endOfGameResult === GAME_RESULT.END) {
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
