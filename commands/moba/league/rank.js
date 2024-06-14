const {
	parseUserIdentifier,
	getSummonerId,
	getLeagueEntries
} = require("./utils.js");

const TARGET_LEAGUE = "RANKED_SOLO_5x5";

module.exports = {
	name: "rank",
	aliases: [],
	description: [

	],
	flags: {
		default: true
	},
	execute: async (context, type, regionName, ...args) => {
		const leagueUser = await parseUserIdentifier(regionName, args.join(" "));
		if (!leagueUser.success) {
			return leagueUser;
		}

		const { puuid, region, gameName } = leagueUser;
		const summonerId = await getSummonerId(region, puuid);
		if (!summonerId) {
			return {
				success: false,
				reply: `No such account exists in ${regionName.toUpperCase()}!`
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
		const winRate = sb.Utils.round(data.wins / (data.wins + data.losses) * 100, 0);

		return {
			reply: sb.Utils.tag.trim `
				${gameName} is currently ${tier} ${data.rank} (${data.leaguePoints} LP),
				with a win/loss of ${data.wins}:${data.losses} (${winRate}% winrate).
			`
		};
	}
};
