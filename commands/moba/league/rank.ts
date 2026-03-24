import { parseUserIdentifier, getLeagueEntries } from "./utils.js";
import { type MobaSubcommandDefinition } from "../index.js";

const TARGET_LEAGUE = "RANKED_SOLO_5x5";
const RANKLESS_TIERS = new Set(["MASTER", "GRANDMASTER", "CHALLENGER"]);

export default {
	name: "rank",
	title: "Rank",
	aliases: [],
	description: [],
	getDescription: (prefix) => [
		`<code>${prefix}league (region) (username)</code>`,
		`<code>${prefix}league rank (region) (username)</code>`,
		`<code>${prefix}league EUW Username#Tag</code>`,
		`<code>${prefix}league rank EUW Username#Tag</code>`,
		"Fetches simple data about a user's tier and rank in the current league."
	],
	default: true,
	flags: {
		default: true
	},
	execute: async (context, type, regionName, ...args) => {
		const leagueUser = await parseUserIdentifier(context, regionName, args.join(" "));
		if (!leagueUser.success) {
			return leagueUser;
		}

		const { puuid, region, gameName } = leagueUser;
		const rawData = await getLeagueEntries(region, puuid);
		const data = rawData.find(i => i.queueType === TARGET_LEAGUE);
		if (!data) {
			return {
				success: false,
				reply: `That user has not played enough ranked solo games in the current season to obtain a rank!`
			};
		}

		const { tier, wins, losses, rank, leaguePoints } = data;
		const tierName = core.Utils.capitalize(tier.toLowerCase());
		const rankString = (RANKLESS_TIERS.has(tier.toUpperCase()))
			? tierName
			: `${tierName} ${rank}`;

		const winRate = core.Utils.round(data.wins / (data.wins + data.losses) * 100, 0);

		return {
			reply: core.Utils.tag.trim `
				${gameName} is currently ${rankString} ${leaguePoints} LP,
				with a win/loss of ${wins}:${losses} (${winRate}% winrate).
			`
		};
	}
} satisfies MobaSubcommandDefinition;
