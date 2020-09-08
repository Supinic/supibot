module.exports = {
	Name: "pingme",
	Aliases: null,
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 15000,
	Description: "Sets a self-notification in the current channel when the target user is spotted in a different channel.",
	Flags: ["mention","opt-out","pipe"],
	Whitelist_Response: null,
	Static_Data: ({
		strings: {
			"public-incoming": "That person has too many public reminders pending!",
			"public-outgoing":  "You have too many public reminders pending!",
			"private-incoming": "That person has too many private reminders pending!",
			"private-outgoing": "You have too many private reminders pending!"
		}
	}),
	Code: (async function pingMe (context, user) {
		if (!user) {
			return { reply: "No user provided!" };
		}
	
		const targetUser = await sb.User.get(user, true);
		if (!targetUser) {
			return { reply: "Target user does not exist!" };
		}
		else if (targetUser.ID === context.user.ID) {
			return { reply: "That makes no sense FeelsDankMan" };
		}
		else if (targetUser.Name === context.platform.Self_Name) {
			return { reply: "Pong! FeelsDankMan I'm here!" };
		}
	
		const { success, cause, ID } = await sb.Reminder.create({
			Channel: context.channel?.ID || null,
			User_From: context.user.ID,
			User_To: targetUser.ID,
			Text: null,
			Schedule: null,
			Created: new sb.Date(),
			Private_Message: Boolean(context.privateMessage),
			Platform: context.platform.ID
		});
	
		if (success && !cause) {
			return {
				reply: "I will ping you when they type in chat (ID " + ID + ")"
			};
		}
		else {
			return {
				reply: this.staticData.strings[cause]
			};
		}
	}),
	Dynamic_Description: null
};