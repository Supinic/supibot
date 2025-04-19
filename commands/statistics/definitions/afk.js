export default {
	name: "afk",
	aliases: ["total-afk", "gn", "brb", "food", "shower", "lurk", "poop", "work", "study", "pppoof"],
	description: "Checks the total time you (or another user) have been afk for. Each status type is separate - you can use total-afk to check all of them combined.",
	execute: async (context, type, user) => {
		const targetUser = (user)
			? await sb.User.get(user)
			: context.user;

		if (!targetUser) {
			return {
				success: false,
				reply: "Provided user does not exist!"
			};
		}
		else if (targetUser === context.platform.Self_Name) {
			return {
				success: false,
				reply: `I'm a bot - and we don't really need to sleep, I'm always awake!`
			};
		}

		/** @type {{ Amount: bigint, Delta: number }} */
		const data = await core.Query.getRecordset(rs => rs
			.select("COUNT(*) AS Amount")
			.select("SUM(UNIX_TIMESTAMP(Ended) - UNIX_TIMESTAMP(Started)) AS Delta")
			.from("chat_data", "AFK")
			.where("User_Alias = %n", targetUser.ID)
			.where("Interrupted_ID IS NULL")
			.where(
				{ condition: (type === "afk") },
				"Status = %s OR Status IS NULL",
				type
			)
			.where(
				{ condition: (type !== "afk" && type !== "total-afk") },
				"Status = %s",
				type
			)
			.single()
		);

		const interruptedAmount = await core.Query.getRecordset(rs => rs
			.select("COUNT(*) AS Amount")
			.from("chat_data", "AFK")
			.where("User_Alias = %n", targetUser.ID)
			.where("Interrupted_ID IS NOT NULL")
			.where(
				{ condition: (type === "afk") },
				"Status = %s OR Status IS NULL",
				type
			)
			.where(
				{ condition: (type !== "afk" && type !== "total-afk") },
				"Status = %s",
				type
			)
			.flat("Amount")
			.single()
		);

		const who = (targetUser === context.user) ? "You have" : "That user has";
		const target = (type === "total-afk") ? "(all combined)" : type;
		if (!data?.Delta) {
			return {
				reply: `${who} not been AFK with status "${target}" at all.`
			};
		}
		else {
			const delta = core.Utils.timeDelta(sb.Date.now() + data.Delta * 1000, true);
			const average = core.Utils.timeDelta(sb.Date.now() + (data.Delta * 1000 / Number(data.Amount)), true);

			return {
				reply: core.Utils.tag.trim `
					${who} been AFK with status "${target}"
					${data.Amount} times,
					for a total of ~${delta}.
					This averages to ~${average} spent AFK per invocation.
					${who} resumed AFK statuses ${interruptedAmount} times.
				`
			};
		}
	}
};
