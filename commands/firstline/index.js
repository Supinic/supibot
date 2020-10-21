module.exports = {
	Name: "firstline",
	Aliases: ["fl"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Posts the target user's first chat line in the context of the current channel, and the date they sent it.",
	Flags: ["mention","opt-out","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function firstLine (context, user) {
		if (!context.channel) {
			return {
				success: false,
				reply: "This command is not available in private messages!"
			};
		}

		const targetUser = (user)
			? await sb.User.get(user)
			: context.user;

		if (!targetUser) {
			return {
				success: false,
				reply: "Provided user not found in the database!"
			};
		}

		const check = await sb.Query.getRecordset(rs => rs
			.select("User_Alias")
			.from("chat_data", "Message_Meta_User_Alias")
			.where("User_Alias = %n", targetUser.ID)
			.where(
				"Channel IN %n+",
				[7, 8, 46].includes(context.channel.ID)
					? [7, 8, 46]
					: [context.channel.ID]
			)
			.limit(1)
			.flat("User_Alias")
			.single()
		);

		if (!check) {
			return {
				success: false,
				reply: "That user has not said anything in this channel!"
			};
		}
	
		let line;
		if ([7, 8, 46].includes(context.channel.ID)) {
			const promises = [7, 8, 46].map(async ID => {
				const channelData = sb.Channel.get(ID);
				return await sb.Query.getRecordset(rs => rs
				    .select("Text", "Posted")
					.from("chat_line", channelData.getDatabaseName())
					.where("User_Alias = %n", targetUser.ID)
					.orderBy("ID ASC")
					.limit(1)
					.single()
				);
			})

			const lineData = (await Promise.all(promises)).filter(Boolean);
			if (!lineData) {
				return {
					success: false,
					reply: "No chat lines found?!"
				};
			}

			lineData.sort((a, b) => a.Posted - b.Posted);
			line = lineData[0];
		}
		else {
			line = await sb.Query.getRecordset(rs => rs
			    .select("Text", "Posted")
				.from("chat_line", context.channel.getDatabaseName())
				.where("User_Alias = %n", targetUser.ID)
				.orderBy("ID ASC")
				.limit(1)
				.single()
			);
		}
	
		if (!line) {
			return {
				success: false,
				reply: "No chat lines found?!"
			};
		}

		const prefix = (targetUser.ID === context.user.ID) ? "Your" : "That user's";
		return {
			partialReplies: [
				{
					bancheck: false,
					message: `${prefix} first message in this channel was (${sb.Utils.timeDelta(line.Posted)}):`
				},
				{
					bancheck: true,
					message: line.Text
				}
			]
		};
	}),
	Dynamic_Description: null
};