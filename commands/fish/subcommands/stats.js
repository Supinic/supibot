module.exports = {
	name: "stats",
	aliases: ["statistics"],
	description: [
		`<code>$fish stats</code>`,
		"Gives you a brief rundown on your fishing statistics.",
		"",

		`<code>$fish stats (username)</code>`,
		"Gives you a brief rundown on someone else's fishing statistics.",
		"",

		`<code>$fish stats global</code>`,
		"Shows off the total, global statistics of fisherman all around the world."
	],
	execute: async (context, userOrGlobal) => {
		let targetUserData;
		if (userOrGlobal === "global") {
			targetUserData = null;
		}
		else {
			targetUserData = (userOrGlobal)
				? await sb.User.get(userOrGlobal)
				: context.user;

			if (!targetUserData) {
				return {
					success: false,
					reply: `No such user exists!`
				};
			}

			if (targetUserData.Name === context.platform.Self_Name) {
				return {
					success: false,
					reply: `I'm sitting on Supinic's table, there's no fish to catch here!`
				};
			}
		}

		const data = await sb.Query.getRecordset(rs => rs
			.select(`SUM(CONVERT(JSON_EXTRACT(Value, '$.lifetime.attempts'), INT)) AS Attempts`)
			.select(`SUM(CONVERT(JSON_EXTRACT(Value, '$.lifetime.baitUsed'), INT)) AS BaitUsed`)
			.select(`SUM(CONVERT(JSON_EXTRACT(Value, '$.lifetime.fish'), INT)) AS FishCaught`)
			.select(`SUM(CONVERT(JSON_EXTRACT(Value, '$.lifetime.junk'), INT)) AS JunkCaught`)
			.select(`SUM(CONVERT(JSON_EXTRACT(Value, '$.lifetime.sold'), INT)) AS FishSold`)
			.select(`SUM(CONVERT(JSON_EXTRACT(Value, '$.lifetime.scrapped'), INT)) AS JunkSold`)
			.select(`MAX(CONVERT(JSON_EXTRACT(Value, '$.lifetime.dryStreak'), INT)) AS WorstDryStreak`)
			.select(`MAX(CONVERT(JSON_EXTRACT(Value, '$.lifetime.luckyStreak'), INT)) AS BestLuckyStreak`)
			.from("chat_data", "User_Alias_Data")
			.where("Property = %s", "fishData")
			.where("JSON_EXTRACT(Value, '$.removedFromLeaderboards') IS NULL")
			.where({ condition: Boolean(targetUserData) }, "User_Alias = %n", targetUserData?.ID)
			.single()
		);

		let prefix = "Global";
		let userAmountString = "";
		if (targetUserData) {
			if (!data.Attempts) { // Can be either `null` or `0` if user has never gone fishing
				const subject = (targetUserData === context.user) ? "You" : "They";
				return {
					reply: `${subject} have never gone fishing before.`
				};
			}

			prefix = (targetUserData === context.user) ? "Your" : "Their";
		}
		else {
			const usersAmount = await sb.Query.getRecordset(rs => rs
				.select("COUNT(User_Alias) AS Amount")
				.from("chat_data", "User_Alias_Data")
				.where("Property = %s", "fishData")
				.where("CONVERT(JSON_EXTRACT(Value, \"$.lifetime.attempts\"), INT) > %d", 0)
			);

			userAmountString = `anglers: ${usersAmount};`;
		}

		const result = sb.Utils.tag.trim `
			attempts: ${sb.Utils.groupDigits(data.Attempts)};
			${userAmountString}
			caught fish: ${sb.Utils.groupDigits(data.FishCaught)};
			caught junk: ${sb.Utils.groupDigits(data.JunkCaught)};
			bait used: ${sb.Utils.groupDigits(data.BaitUsed)};
			fish sold: ${sb.Utils.groupDigits(data.FishSold)};
			junk scrapped: ${sb.Utils.groupDigits(data.JunkSold)};
			worst dry streak: ${sb.Utils.groupDigits(data.WorstDryStreak)};
			best lucky streak: ${sb.Utils.groupDigits(data.BestLuckyStreak)}.
		`;

		return {
			reply: `${prefix} fishing stats → ${result}`
		};
	}
};
