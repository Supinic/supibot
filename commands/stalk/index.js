module.exports = {
	Name: "stalk",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "For a given user, attempts to find the message they last sent in chat, plus the channel and time when they posted it.",
	Flags: ["block","external-input","mention","opt-out","pipe"],
	Params: null,
	Whitelist_Response: null,
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
		else if (targetUser.ID === context.user.ID && context.channel) {
			// Only post the "easter egg" message if used on the executing user in a channel chat
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

		const stalkData = await sb.Query.getRecordset(rs => rs
			.select("Last_Message_Text AS Text", "Last_Message_Posted AS Date", "Channel.ID AS ChannelID")
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

		if (!stalkData) {
			return {
				reply: sb.Utils.tag.trim `
					That user is in the database, but never showed up in chat.
					They were first spotted ${sb.Utils.timeDelta(targetUser.Started_Using)}.
				`
			};
		}

		const stalkChannelData = sb.Channel.get(stalkData.ChannelID);
		const delta = sb.Utils.timeDelta(stalkData.Date);

		// Automated protection of the bot from being banned:
		// Do not allow stalking of banned Twitch users in Twitch channels - available in Twitch whispers and other platforms.
		if (targetUser.Twitch_ID && context.platform.Name === "twitch" && context.channel && stalkChannelData.Platform.Name === "twitch") {
			const response = await sb.Got("IVR", {
				url: "v2/twitch/user",
				searchParams: {
					id: targetUser.Twitch_ID
				}
			});

			// Only refuse to send the message if the ban type ("reason") is a TOS violation.
			// Memo: possibly also refuse to send when type is `DEACTIVATED`?
			let userInfo;
			if (Array.isArray(response.body)) {
				userInfo = response.body[0];
			}
			else {
				userInfo = response.body;
			}

			const omittedBanReasons = ["TOS_TEMPORARY", "TOS_INDEFINITE"];
			if (userInfo && userInfo.banned && omittedBanReasons.includes(userInfo.banReason)) {
				return {
					success: false,
					reply: "You cannot stalk that user as they're currently banned on Twitch!"
				};
			}
		}

		const who = (context.user === targetUser)
			? "You were"
			: "That user was";

		return {
			meta: {
				skipWhitespaceCheck: true
			},
			reply: sb.Utils.tag.trim `
				${who} last seen in chat ${delta}, 
				(${stalkChannelData.getFullName()})
				last message:
				${stalkData.Text}
			`
		};
	}),
	Dynamic_Description: null
};
