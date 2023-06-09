const { itemTypes } = require("./fishing-utils.js");

const unping = (str) => `${str[0]}\u{E0000}${str.slice(1)}`;

const typeProperty = {
	fish: ["catch.fish", "anglers"],
	junk: ["catch.junk", "junkrats"],
	coins: ["coins", "coin collectors"],
	lucky: ["catch.luckyStreak", "lucky ducks"],
	unlucky: ["catch.dryStreak", "jinxed sphinxes"],
	"total-unlucky": ["lifetime.dryStreak", "all-time unluckiest anglers"]
};

for (const item of itemTypes) {
	typeProperty[item.name] = [`catch.types.${item.name}`, item.name];
}

module.exports = {
	name: "leaderboard",
	aliases: ["top"],
	description: [
		`<code>$fish leaderboard</code>`,
		`<code>$fish top</code>`,
		`<code>$fish leaderboard fish</code>`,
		`<code>$fish top fish</code>`,
		"Shows the list of top anglers - most currently owned fish.",
		"",

		`<code>$fish top junk</code>`,
		"Shows the list of top junk 'collectors' - most currently owned pieces of junk.",
		"",

		`<code>$fish top coins</code>`,
		"Shows the list of top coin collectors - most currently owned coins.",
		"",

		`<code>$fish top (item emoji)</code>`,
		`<code>$fish top 🐠</code>`,
		`<code>$fish top 💀</code>`,
		"Shows the list of top collectors for a specified item, fish or junk.",
		"",

		`<code>$fish top lucky</code>`,
		"Shows the list of the luckiest anglers - currently on the best lucky streak.",
		"",

		`<code>$fish top unlucky</code>`,
		"Shows the list of the unluckiest anglers - currently on the worst unlucky streak.",
		"",

		`<code>$fish top total-unlucky</code>`,
		"Shows the list of the unluckiest anglers of all time - worst unlucky streaks of all time (not currently)."
	],
	execute: async (context, type) => {
		const leaderboardType = type ?? "fish";
		if (!typeProperty[leaderboardType]) {
			const types = Object.keys(typeProperty);
			return {
				success: false,
				reply: `Invalid leaderboard type provided! Use one of: ${types.join(", ")}`
			};
		}

		const [dataProperty, name] = typeProperty[leaderboardType];
		const data = await sb.Query.getRecordset(rs => rs
			.select("User_Alias.Name AS Username")
			.select(`CONVERT(JSON_EXTRACT(Value, '$.${dataProperty}'), INT) AS Total`)
			.from("chat_data", "User_Alias_Data")
			.join("chat_data", "User_Alias")
			.where("Property = %s", "fishData")
			.where(`JSON_EXTRACT(Value, '$.${dataProperty}') IS NOT NULL`)
			.where("JSON_EXTRACT(Value, '$.removedFromLeaderboards') IS NULL")
			.orderBy(`CONVERT(JSON_EXTRACT(Value, '$.${dataProperty}'), INT) DESC`)
			.limit(10)
		);

		const result = data.map((i, ind) => `Rank ${ind + 1}: ${unping(i.Username)} (${i.Total}x)`);
		return {
			meta: {
				skipWhitespaceCheck: true
			},
			reply: `Top 10 ${name}: ${result.join("; ")}`
		};
	}
};
