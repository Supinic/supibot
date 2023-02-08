module.exports = {
	name: "longest-afk",
	aliases: [],
	description: "Checks the longest time you (or another user) have been AFK for.",
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

		const data = await sb.Query.getRecordset(rs => rs
			.select("Started", "Ended")
			.from("chat_data", "AFK")
			.where("User_Alias = %n", targetUser.ID)
			.where("Interrupted_ID IS NULL")
			.where("NOT EXISTS(SELECT 1 FROM chat_data.AFK AS SubAFK WHERE AFK.ID = SubAFK.Interrupted_ID LIMIT 1)")
			.orderBy("(UNIX_TIMESTAMP(Ended) - UNIX_TIMESTAMP(Started)) DESC")
			.limit(1)
			.single()
		);

		const who = (targetUser === context.user) ? "You have" : "That user has";
		if (!data) {
			return {
				reply: `${who} not been AFK before at all.`
			};
		}

		const delta = sb.Utils.timeDelta(data.Started, true, true, data.Ended);
		const started = sb.Utils.timeDelta(data.Started);
		const ended = sb.Utils.timeDelta(data.Ended);

		return {
			reply: sb.Utils.tag.trim `
							The longest time ${who.toLowerCase()} been AFK for
							is ${delta}, 
							which started ${started}
							and ended ${ended}.
						`
		};
	}
};
