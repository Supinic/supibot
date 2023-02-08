module.exports = {
	Name: "lastline",
	Aliases: ["ll","lastmessage","lm"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Posts the target user's last chat line in the context of the current channel, and the date they sent it.",
	Flags: ["external-input","mention","opt-out","pipe"],
	Params: [
		{ name: "textOnly", type: "boolean" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function lastLine (context, user) {
		if (!user) {
			return {
				success: false,
				reply: "No user provided!"
			};
		}
		else if (!context.channel) {
			return {
				success: false,
				reply: "This command is not available in PMs!"
			};
		}

		const targetUser = await sb.User.get(user, true);
		if (!targetUser) {
			return {
				success: false,
				reply: "User not found in the database!"
			};
		}
		else if (targetUser.Name === context.platform.Self_Name) {
			return {
				success: false,
				reply: "I'm right here! Boo! 👻"
			};
		}

		const userID = targetUser.ID;
		if (userID === context.user.ID) {
			return {
				success: false,
				reply: "You're right here! 👻 I can see you"
			};
		}

		let data = null;
		if ([7, 8, 46].includes(context.channel.ID)) {
			data = (await sb.Query.getRecordset(rs => rs
				.select("Last_Message_Text AS Message", "Last_Message_Posted AS Posted")
				.from("chat_data", "Message_Meta_User_Alias")
				.where("User_Alias = %n", userID)
				.where("Channel IN (7, 8, 46)")
				.orderBy("Last_Message_Posted DESC")
			))[0];
		}
		else {
			data = (await sb.Query.getRecordset(rs => rs
				.select("Last_Message_Text AS Message", "Last_Message_Posted AS Posted")
				.from("chat_data", "Message_Meta_User_Alias")
				.where("User_Alias = %n", userID)
				.where("Channel = %n", context.channel.ID)
			))[0];
		}

		if (!data) {
			return {
				success: false,
				reply: "That user has not said anything in this channel!"
			};
		}

		if (context.params.textOnly) {
			return {
				reply: data.Message
			};
		}

		const prefix = (targetUser.ID === context.user.ID) ? "Your" : "That user's";
		return {
			partialReplies: [
				{
					bancheck: false,
					message: `${prefix} last message in this channel was (${sb.Utils.timeDelta(data.Posted)}):`
				},
				{
					bancheck: true,
					message: data.Message
				}
			]
		};
	}),
	Dynamic_Description: null
};
