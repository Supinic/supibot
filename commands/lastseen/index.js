module.exports = {
	Name: "lastseen",
	Aliases: ["ls"],
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 5000,
	Description: "Posts the target user's last chat line in all chats combined (!) and the date they sent it.",
	Flags: ["block","mention","opt-out","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function lastSeen (context, user) {
		if (!user) {
			return {
				success: false,
				reply: "🙂 You were last seen: right now!"
			};
		}
	
		const targetUser = await sb.User.get(user);
		if (!targetUser) {
			return {
				success: false,
				reply: "User not found in the database!"
			};
		}
		else if (targetUser.ID === context.user.ID) {
			return {
				success: false,
				reply: "Oh wow, look at that! You were last seen: Right now! 😆"
			};
		}
		else if (targetUser.Name === context.platform.Self_Name) {
			return {
				success: false,
				reply: "🤖 I'm always around!"
			};
		}
	
		const date = await sb.Query.getRecordset(rs => rs
			.select("Last_Message_Posted AS Date")
			.from("chat_data", "Message_Meta_User_Alias")
			.where("User_Alias = %n", targetUser.ID)
			.orderBy("Last_Message_Posted DESC")
			.limit(1)
			.single()
			.flat("Date")
		);
	
		if (!date) {
			return {
				reply: "That user is in the database, but never showed up in chat."
			};
		}
	
		return {
			reply: `That user was last seen ${sb.Utils.timeDelta(date)}.`
		};
	}),
	Dynamic_Description: null
};