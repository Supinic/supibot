import { hasFishedBefore } from "./fishing-utils.js";

export default {
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

		const data = await core.Query.getRecordset(rs => rs
			.select(`SUM(CONVERT(JSON_EXTRACT(Value, '$.lifetime.attempts'), INT)) AS Attempts`)
			.select(`SUM(CONVERT(JSON_EXTRACT(Value, '$.lifetime.baitUsed'), INT)) AS BaitUsed`)
			.select(`SUM(CONVERT(JSON_EXTRACT(Value, '$.lifetime.fish'), INT)) AS FishCaught`)
			.select(`SUM(CONVERT(JSON_EXTRACT(Value, '$.lifetime.junk'), INT)) AS JunkCaught`)
			.select(`SUM(CONVERT(JSON_EXTRACT(Value, '$.lifetime.sold'), INT)) AS FishSold`)
			.select(`SUM(CONVERT(JSON_EXTRACT(Value, '$.lifetime.scrapped'), INT)) AS JunkSold`)
			.select(`SUM(CONVERT(JSON_EXTRACT(Value, '$.lifetime.trap.times'), INT)) AS TrapsSet`)
			.select(`MAX(CONVERT(JSON_EXTRACT(Value, '$.lifetime.dryStreak'), INT)) AS WorstDryStreak`)
			.select(`MAX(CONVERT(JSON_EXTRACT(Value, '$.lifetime.luckyStreak'), INT)) AS BestLuckyStreak`)
			.from("chat_data", "User_Alias_Data")
			.where("Property = %s", "fishData")
			.where({ condition: !(targetUserData) }, "JSON_EXTRACT(Value, '$.removedFromLeaderboards') IS NULL")
			.where({ condition: Boolean(targetUserData) }, "User_Alias = %n", targetUserData?.ID)
			.single()
		);

		let prefix = "Global";
		let userAmountString = "";
		let appendix = "";
		if (targetUserData) {
			/** @type {UserFishData} */
			const fishData = await targetUserData.getDataProperty("fishData");
			const subject = (targetUserData === context.user) ? "You" : "They";
			if (!hasFishedBefore(fishData)) {
				return {
					reply: `${subject} have never gone fishing before.`
				};
			}

			prefix = (targetUserData === context.user) ? "Your" : "Their";

			if (fishData.removedFromLeaderboards) {
				appendix = `${prefix} fishing licence has been revoked.`;
			}
		}
		else {
			const usersAmount = await core.Query.getRecordset(rs => rs
				.select("COUNT(User_Alias) AS Amount")
				.from("chat_data", "User_Alias_Data")
				.where("Property = %s", "fishData")
				.where("CONVERT(JSON_EXTRACT(Value, \"$.lifetime.attempts\"), INT) > %n", 0)
				.flat("Amount")
				.single()
			);

			userAmountString = `anglers: ${core.Utils.groupDigits(usersAmount)};`;
		}

		const result = core.Utils.tag.trim `
			attempts: ${core.Utils.groupDigits(data.Attempts)};
			${userAmountString}
			caught fish: ${core.Utils.groupDigits(data.FishCaught)};
			caught junk: ${core.Utils.groupDigits(data.JunkCaught)};
			traps set up: ${core.Utils.groupDigits(data.TrapsSet)};
			bait used: ${core.Utils.groupDigits(data.BaitUsed)};
			fish sold: ${core.Utils.groupDigits(data.FishSold)};
			junk scrapped: ${core.Utils.groupDigits(data.JunkSold)};
			worst dry streak: ${core.Utils.groupDigits(data.WorstDryStreak)};
			best lucky streak: ${core.Utils.groupDigits(data.BestLuckyStreak)}.
			${appendix}
		`;

		return {
			reply: `${prefix} fishing stats → ${result}`
		};
	}
};
