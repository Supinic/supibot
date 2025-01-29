export default {
	Name: "countline",
	Aliases: ["cl"],
	Author: "supinic",
	Cooldown: 15000,
	Description: "Fetches the number of chat lines a specified user (or you, if nothing is provided) has sent in the current channel.",
	Flags: ["mention","opt-out","pipe"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function countLine (context, user) {
		if (!context.channel) {
			return {
				success: false,
				reply: `This command is not available here!`
			};
		}

		if (user) {
			user = await sb.User.get(user, true);
			if (!user) {
				return {
					reply: "No such user exists in the database!"
				};
			}
		}
		else {
			user = context.user;
		}

		let lines;
		if ([7, 8, 46].includes(context.channel.ID)) {
			lines = await sb.Query.getRecordset(rs => rs
				.select("SUM(Message_Count) AS Total")
				.from("chat_data", "Message_Meta_User_Alias")
				.where("User_Alias = %n", user.ID)
				.where("Channel IN(7, 8, 46)")
				.single()
				.flat("Total")
			);
		}
		else {
			lines = await sb.Query.getRecordset(rs => rs
				.select("Message_Count AS Total")
				.from("chat_data", "Message_Meta_User_Alias")
				.where("User_Alias = %n", user.ID)
				.where("Channel = %n", context.channel.ID)
				.single()
				.flat("Total")
			);
		}
		if (!lines) {
			return {
				reply: "That user has sent no chat lines in this channel!"
			};
		}

		const who = (user.ID === context.user.ID) ? "You have" : "That user has";
		return {
			reply: `${who} sent ${sb.Utils.groupDigits(lines)} chat lines in this channel so far.`
		};
	}),
	Dynamic_Description: null
};
