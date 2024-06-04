const {
	getPUUIDByName,
	getSummonerID,
	getLeagueEntries,
	getPlatform
} = require("./utils.js");

const TARGET_LEAGUE = "RANKED_SOLO_5x5";

module.exports = {
	name: "rank",
	aliases: [],
	description: [

	],
	execute: async (context, type, regionName, userIdentifier) => {
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

		const [gameName, tagLine] = userIdentifier.split("#");
		if (!gameName || !tagLine || tagLine.length > 4) {
			return {
				success: false,
				reply: `Invalid full user name provided! It must be in format (user)#(tag)`
			};
		}

		const puuid = await getPUUIDByName(gameName, tagLine);
		if (!puuid) {
			return {
				success: false,
				reply: `No such user exists!`
			};
		}

		const summonerId = await getSummonerID(region, puuid);
		if (!summonerId) {
			return {
				success: false,
				reply: `No such account exists on ${regionName}!`
			};
		}

		const rawData = await getLeagueEntries(region, summonerId);
		const data = rawData.find(i => i.queueType === TARGET_LEAGUE);
		if (!data) {
			return {
				success: false,
				reply: `That user has not played any ranked solo games in the current season!`
			};
		}

		const tier = sb.Utils.capitalize(data.tier.toLowerCase());
		const winRate = sb.Utils.round(data.wins / (data.wins + data.losses), 0);

		return {
			reply: sb.Utils.tag.trim `
				${gameName} is currently ${tier} ${data.rank} (${data.leaguePoints} LP),
				with a win/loss of ${data.wins}:${data.losses} (${winRate}% winrate).
			`
		};
	}
}
