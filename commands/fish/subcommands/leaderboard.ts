import { itemTypes } from "./fishing-utils.js";
import { unping } from "../../../utils/command-utils.js";

// @todo refactor to FishSubcommandDefinition once `$fish` is being reworked to TS
import type { SubcommandDefinition as GenericSubcommandDefinition } from "../../../classes/command.js";
import type { UserDataPropertyMap } from "../../../classes/custom-data-properties.js";

type FishData = UserDataPropertyMap["fishData"];
type TopResult = { userId: number; value: number };

type LeaderboardConfig = {
	sqlPath: string;
	name: string;
	getTotal: (data: NonNullable<FishData>) => number | null;
};
const baseTypes = {
	fish: {
		sqlPath: "catch.fish",
		name: "anglers",
		getTotal: (data) => data.catch.fish
	},
	"total-fish": {
		sqlPath: "lifetime.fish",
		name: "all-time piscators",
		getTotal: (data) => data.lifetime.fish
	},
	coins: {
		sqlPath: "coins",
		name: "coin collectors",
		getTotal: (data) => data.coins
	},
	"total-coins": {
		sqlPath: "lifetime.coins",
		name: "all-time scrooges",
		getTotal: (data) => data.lifetime.coins
	},
	junk: {
		sqlPath: "catch.junk",
		name: "junkrats",
		getTotal: (data) => data.catch.junk ?? null
	},
	"total-junk": {
		sqlPath: "lifetime.junk",
		name: "all-time scraphounds",
		getTotal: (data) => data.lifetime.junk ?? null
	},
	lucky: {
		sqlPath: "catch.luckyStreak",
		name: "lucky ducks",
		getTotal: (data) => data.catch.luckyStreak
	},
	"total-lucky": {
		sqlPath: "lifetime.luckyStreak",
		name: "all-time lucky ducks",
		getTotal: (data) => data.lifetime.luckyStreak
	},
	unlucky: {
		sqlPath: "catch.dryStreak",
		name: "jinxed sphinxes",
		getTotal: (data) => data.catch.dryStreak
	},
	"total-unlucky": {
		sqlPath: "lifetime.dryStreak",
		name: "all-time unluckiest anglers",
		getTotal: (data) => data.lifetime.dryStreak
	},
	traps: {
		sqlPath: "lifetime.trap.times",
		name: "most persistent trappers",
		getTotal: (data) => data.lifetime.trap?.times ?? null
	},
	attempts: {
		sqlPath: "lifetime.attempts",
		name: "most persistent trawlers",
		getTotal: (data) => data.lifetime.attempts
	}
} satisfies Record<string, LeaderboardConfig>;

const leaderboardTypes = new Map<string, LeaderboardConfig>(Object.entries(baseTypes));
for (const item of itemTypes) {
	leaderboardTypes.set(item.name, {
		sqlPath: `catch.types.${item.name}`,
		name: `${item.name} collectors`,
		getTotal: (data) => data.catch.types[item.name] ?? null
	});
}

type RankGroup = {
	rank: number;
	value: number;
	usernames: string[];
};
const createRankedMessages = async (results: readonly TopResult[]): Promise<string[]> => {
	const groups = new Map<number, RankGroup>();
	for (let index = 0; index < results.length; index++) {
		const { userId, value } = results[index];
		const existingGroup = groups.get(value);
		const userData = await sb.User.getAsserted(userId);
		if (existingGroup) {
			existingGroup.usernames.push(userData.Name);
			continue;
		}

		groups.set(value, {
			rank: index + 1,
			value,
			usernames: [userData.Name]
		});
	}

	const result = [];
	for (const { rank, value, usernames } of groups.values()) {
		const names = usernames.map(i => unping(i)).join(" ");
		result.push(`Rank #${rank} (${value}): ${names}`);
	}

	return result;
};

export default {
	name: "leaderboard",
	aliases: ["top"],
	title: "Leaderboards, rankings and statistics",
	description: [
		`<code>$fish top</code>`,
		`<code>$fish top fish</code>`,
		"Shows the list of top anglers - most currently owned fish.",
		"",

		`<code>$fish top (item emoji)</code>`,
		`<code>$fish top 🐠</code>`,
		`<code>$fish top 💀</code>`,
		"Shows the list of top collectors for a specified item, fish or junk.",
		"",

		`<code>$fish top attempts</code>`,
		`<code>$fish top traps</code>`,
		"Shows the list of the most persistent fishermen (most fishing attempts) or trappers (traps set up).",
		"",

		`<code>$fish top coins</code>`,
		`<code>$fish top junk</code>`,
		`<code>$fish top lucky</code>`,
		`<code>$fish top unlucky</code>`,
		"Shows the list of top owners of a given category - according to its name.",
		"These are current ones, e.g. \"as many coins as they have now\".",
		"",

		`<code>$fish top total-fish</code>`,
		`<code>$fish top total-coins</code>`,
		`<code>$fish top total-junk</code>`,
		`<code>$fish top total-lucky</code>`,
		`<code>$fish top total-unlucky</code>`,
		"Shows the list of top owners all-time in a given category - according to its name.",
		"These are <b>NOT</b> the current ones, but rather all-time statistics."
	],
	execute: async (context, leaderboardType: string = "fish") => {
		const config = leaderboardTypes.get(leaderboardType);
		if (!config) {
			const types = [...leaderboardTypes.keys()];
			return {
				success: false,
				reply: `Invalid leaderboard type provided! Use one of: ${types.join(", ")}`
			};
		}

		const { sqlPath, name, getTotal } = config;
		const data = await core.Query.getRecordset<TopResult[]>(rs => rs
			.select("User_Alias AS userId")
			.select(`CONVERT(JSON_EXTRACT(Value, '$.${sqlPath}'), INT) AS value`)
			.from("chat_data", "User_Alias_Data")
			.where("Property = %s", "fishData")
			.where(`JSON_EXTRACT(Value, '$.${sqlPath}') IS NOT NULL`)
			.where("JSON_EXTRACT(Value, '$.removedFromLeaderboards') IS NULL")
			.orderBy(`value DESC`)
			.limit(10)
		);

		const rankMessages = await createRankedMessages(data);
		const messages = [`Top 10 ${name}:`, ...rankMessages];

		const appearsInTopTen = data.some(i => i.userId === context.user.ID);
		if (!appearsInTopTen) {
			let userRankMessage: string | null = null;
			const userFishData = await context.user.getDataProperty("fishData");
			if (userFishData?.removedFromLeaderboards) {
				userRankMessage = "You are not eligible for a rank, because your fishing licence has been revoked.";
			}
			else if (userFishData) {
				const userValue = getTotal(userFishData);
				if (typeof userValue === "number") {
					const userRank = await core.Query.getRecordset<number>(rs => rs
						.select("COUNT(*) + 1 AS rank")
						.from("chat_data", "User_Alias_Data")
						.where("Property = %s", "fishData")
						.where("JSON_EXTRACT(Value, '$.removedFromLeaderboards') IS NULL")
						.where(`JSON_EXTRACT(Value, '$.${sqlPath}') IS NOT NULL`)
						.where(`CONVERT(JSON_EXTRACT(Value, '$.${sqlPath}'), INT) > %n`, userValue)
						.single()
						.flat("rank")
					);

					userRankMessage = `Your rank is: #${userRank} (${userValue})`;
				}
			}

			if (userRankMessage) {
				messages.push(userRankMessage);
			}
		}

		return {
			meta: { skipWhitespaceCheck: true },
			reply: messages.join(" ")
		};
	}
} satisfies GenericSubcommandDefinition;
