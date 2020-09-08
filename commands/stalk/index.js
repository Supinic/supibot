module.exports = {
	Name: "stalk",
	Aliases: null,
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 5000,
	Description: "For a given user, attempts to find the message they last sent in chat, plus the channel and time when they posted it.",
	Flags: ["block","mention","opt-out","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function stalk (context, user) {
		if (!user) {
			return { 
				success: false,
				reply: "👀 I'm watching you... (no user provided!)"
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
				reply: "👀 You're right here 👀"
			};
		}
		else if (targetUser.Name === context.platform.Self_Name) {
			return {
				success: false,
				reply: "🤖 I'm right here 🤖" 
			};
		}
	
		const stalk = await sb.Query.getRecordset(rs => rs
			.select("Last_Message_Text AS Text", "Last_Message_Posted AS Date", "Channel.Name AS Channel")
			.select("Platform.Name AS Platform")
			.from("chat_data", "Message_Meta_User_Alias")
			.join("chat_data", "Channel")
			.join({
				toDatabase: "chat_data",
				toTable: "Platform",
				on: "Channel.Platform = Platform.ID"
			})
			.where("User_Alias = %n", targetUser.ID)
			.orderBy("Last_Message_Posted DESC")
			.limit(1)
			.single()
		);
	
		if (!stalk) {
			return {
				reply: "I have seen that user before, but they haven't posted any chat lines yet." 
			};
		}
	
		const delta = sb.Utils.timeDelta(stalk.Date);
		const channel = (stalk.Platform === "Twitch" || stalk.Platform === "Mixer")
			? `${stalk.Platform.toLowerCase()}-${stalk.Channel}`
			: stalk.Platform;
	
		return {
			meta: {
				skipWhitespaceCheck: true
			},
			partialReplies: [
				{
					bancheck: false,
					message: `That user was last seen in chat ${delta}, (channel: ${channel}) their last message:`
				},
				{
					bancheck: true,
					message: stalk.Text
				}
			]
		};
	}),
	Dynamic_Description: null
};