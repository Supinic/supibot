module.exports = {
	Name: "stalk",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "For a given user, attempts to find the message they last sent in chat, plus the channel and time when they posted it.",
	Flags: ["block","external-input","mention","opt-out","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function stalk (context, user) {
		if (!user) {
			const emote = await context.getBestAvailableEmote(["forsen1"], "👀");
			return {
				success: false,
				reply: `${emote} I'm watching you... (no user provided!)`
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
			const emote = await context.getBestAvailableEmote(["forsen1"], "👀");
			return {
				success: false,
				reply: `${emote} You're right here ${emote}`
			};
		}
		else if (targetUser.Name === context.platform.Self_Name) {
			const emote = await context.getBestAvailableEmote(["MrDestructoid"], "🤖");
			return {
				success: false,
				reply: `${emote} I'm right here ${emote}`
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
				reply: sb.Utils.tag.trim `
					That user is in the database, but never showed up in chat.
					They were first spotted ${sb.Utils.timeDelta(targetUser.Started_Using)}.
				`
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
