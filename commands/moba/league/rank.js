import {
	parseUserIdentifier,
	getSummonerId,
	getLeagueEntries
} from "./utils.js";

const TARGET_LEAGUE = "RANKED_SOLO_5x5";

export default {
	name: "rank",
	aliases: [],
	description: [
		"<code>$league (region) (username)</code>",
		"<code>$league rank (region) (username)</code>",
		"<code>$league EUW Username#Tag</code>",
		"<code>$league rank EUW Username#Tag</code>",
		"Fetches simple data about a user's tier and rank in the current league."
	],
	flags: {
		default: true
	},
	execute: async (context, type, regionName, ...args) => {
		const leagueUser = await parseUserIdentifier(context, regionName, args.join(" "));
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
				reply: `That user has not played enough ranked solo games in the current season to obtain a rank!`
			};
		}

		const tier = core.Utils.capitalize(data.tier.toLowerCase());
		const winRate = core.Utils.round(data.wins / (data.wins + data.losses) * 100, 0);

		return {
			reply: core.Utils.tag.trim `
				${gameName} is currently ${tier} ${data.rank} (${data.leaguePoints} LP),
				with a win/loss of ${data.wins}:${data.losses} (${winRate}% winrate).
			`
		};
	}
};
