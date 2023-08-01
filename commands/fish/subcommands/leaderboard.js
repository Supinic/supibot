const { itemTypes } = require("./fishing-utils.js");

const unping = (str) => `${str[0]}\u{E0000}${str.slice(1)}`;

const typeProperty = {
	fish: ["catch.fish", "anglers"],
	"total-fish": ["lifetime.fish", "all-time piscators"],
	junk: ["catch.junk", "junkrats"],
	"total-junk": ["lifetime.junk", "all-time scraphounds"],
	coins: ["coins", "coin collectors"],
	"total-coins": ["lifetime.coins", "all-time scrooges"],
	lucky: ["catch.luckyStreak", "lucky ducks"],
	"total-lucky": ["lifetime.luckyStreak", "all-time lucky ducks"],
	unlucky: ["catch.dryStreak", "jinxed sphinxes"],
	"total-unlucky": ["lifetime.dryStreak", "all-time unluckiest anglers"],
	attempts: ["lifetime.attempts", "most persistent trawlers"],
	traps: ["lifetime.trap.times", "most persisent trappers"]
};

for (const item of itemTypes) {
	typeProperty[item.name] = [`catch.types.${item.name}`, `${item.name} collectors`];
}

module.exports = {
	name: "leaderboard",
	aliases: ["top"],
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
			.select("RANK() OVER(ORDER BY Total DESC) AS Rank")
			.from("chat_data", "User_Alias_Data")
			.join("chat_data", "User_Alias")
			.where("Property = %s", "fishData")
			.where(`JSON_EXTRACT(Value, '$.${dataProperty}') IS NOT NULL`)
			.where("JSON_EXTRACT(Value, '$.removedFromLeaderboards') IS NULL")
			.orderBy(`CONVERT(JSON_EXTRACT(Value, '$.${dataProperty}'), INT) DESC`)
			.orderBy(`Username DESC`)
			.limit(10)
		);

		let previousRank = null;
		let rankMessage = [];
		const message = [`Top 10 ${name}:`];
		for (let i = 0; i < 10; i++) {
			const stats = data[i];
			if (previousRank !== stats.Rank) {
				if (rankMessage.length !== 0) {
					message.push(rankMessage.join(" "));
					rankMessage = [];
				}

				previousRank = stats.Rank;
				rankMessage.push(`Rank #${stats.Rank} (${stats.Total}):`);
			}

			rankMessage.push(unping(stats.Username));
		}

		if (rankMessage.length !== 0) {
			message.push(rankMessage.join(" "));
		}

		const userFishData = await context.user.getDataProperty("fishData");
		if (userFishData && data.every(i => i.Username !== context.user.Name)) {
			const [userStats] = await sb.Query.raw(`
				SELECT Total, Rank
				FROM (
			    	SELECT
			          User_Alias,
			          CONVERT(JSON_EXTRACT(Value, "$.${dataProperty}"), INT) AS Total,
			          RANK() OVER (ORDER BY Total DESC) AS Rank
			      	FROM chat_data.User_Alias_Data
			     	WHERE 
			     		Property = "fishData"
						AND JSON_EXTRACT(Value, "$.${dataProperty}") IS NOT NULL
			    ) AS Temp
				WHERE User_Alias = ${context.user.ID}
			`);

			if (userStats) {
				if (userFishData.removedFromLeaderboards) {
					message.push("You are not eligible for a rank, because your fishing licence has been revoked.");
				}
				else {
					message.push(`Your rank is: #${userStats.Rank} (${userStats.Total})`);
				}
			}
		}

		return {
			meta: {
				skipWhitespaceCheck: true
			},
			reply: message.join(" ")
		};
	}
};
