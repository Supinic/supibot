export default {
	Name: "lastseen",
	Aliases: ["ls"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "For a given user, this command tells you when they were last seen - based on their chat activity.",
	Flags: ["block","mention","opt-out","pipe"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function lastSeen (context, user) {
		if (!user) {
			const emote = await context.randomEmote("FeelsDankMan", "🙂");
			return {
				success: false,
				reply: `${emote} You were last seen: right now!`
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
			const emote = await context.randomEmote("PepeLaugh", "pepeLaugh", "LULW", "LuL", "😆");
			return {
				success: false,
				reply: `Oh wow, look at that! You were last seen: Right now! ${emote}`
			};
		}
		else if (targetUser.Name === context.platform.Self_Name) {
			const emote = await context.randomEmote("supiniStare", "supiniPoint", "monkaStare", "MrDestructoid", "🤖");
			return {
				success: false,
				reply: `${emote} I'm always around!`
			};
		}

		let date = sb.Logger.getUserLastSeen(targetUser.ID);
		if (!date) {
			date = await core.Query.getRecordset(rs => rs
				.select("Last_Message_Posted AS Date")
				.from("chat_data", "Message_Meta_User_Alias")
				.where("User_Alias = %n", targetUser.ID)
				.orderBy("Last_Message_Posted DESC")
				.limit(1)
				.single()
				.flat("Date")
			);
		}
		if (!date) {
			return {
				reply: core.Utils.tag.trim `
					That user is in the database, but never showed up in chat.
					They were first spotted ${core.Utils.timeDelta(targetUser.Started_Using)}.
				`
			};
		}

		const who = (context.user === targetUser)
			? "You were"
			: "That user was";

		return {
			reply: `${who} last seen in chat ${core.Utils.timeDelta(date)}.`
		};
	}),
	Dynamic_Description: null
};
