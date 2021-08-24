module.exports = {
	Name: "pingme",
	Aliases: null,
	Author: "supinic",
	Cooldown: 15000,
	Description: "Sets a self-notification in the current channel when the target user is spotted in a different channel.",
	Flags: ["mention","opt-out","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (() => ({
		strings: {
			"public-incoming": "That person has too many public reminders pending!",
			"public-outgoing": "You have too many public reminders pending!",
			"private-incoming": "That person has too many private reminders pending!",
			"private-outgoing": "You have too many private reminders pending!"
		}
	})),
	Code: (async function pingMe (context, user) {
		if (!user) {
			return {
				success: false,
				reply: "No target user provided!"
			};
		}

		const dankEmote = await context.getBestAvailableEmote(["FeelsDankMan", "BrokeBack"], "🤪");
		const targetUser = await sb.User.get(user, true);
		if (!targetUser) {
			return {
				success: false,
				reply: "Target user does not exist!"
			};
		}
		else if (targetUser.ID === context.user.ID) {
			return {
				success: false,
				reply: `Pong! You just typed in chat! ${dankEmote}`
			};
		}
		else if (targetUser.Name === context.platform.Self_Name) {
			return {
				success: false,
				reply: `Pong! I just typed in chat! ${dankEmote}`
			};
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
				reply: `I will ping you when they type in chat (ID ${ID})`
			};
		}
		else {
			return {
				reply: `Could not set up a ping! ${this.staticData.strings[cause] ?? "(Unknown)"}`
			};
		}
	}),
	Dynamic_Description: null
};
