module.exports = {
	Name: "pingme",
	Aliases: ["letmeknow", "lmk"],
	Author: "supinic",
	Cooldown: 15000,
	Description: "Sets a self-notification in the current channel when the target user is spotted in a different channel.",
	Flags: ["block","mention","opt-out","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (() => ({
		strings: {
			"public-incoming": "That person has too many public reminders pending!",
			"public-outgoing": "You have too many public reminders pending!",
			"private-incoming": "That person has too many private reminders pending!",
			"private-outgoing": "You have too many private reminders pending!",
			"existing-pingme": "You already have a \"pingme\" reminder set up for that user!",
		}
	})),
	Code: (async function pingMe (context, user, ...args) {
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
			Text: args.filter(Boolean).join(" ") ?? null,
			Schedule: null,
			Created: new sb.Date(),
			Private_Message: Boolean(context.privateMessage),
			Platform: context.platform.ID,
			Type: "Pingme"
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
	Dynamic_Description: (async (prefix) => [
		"Sets a notification to yourself for when the target user types in a channel with Supibot.",
		"",

		`<code>${prefix}pingme (user)</code>`,
		"When the target user types a message, you will be reminder in the current channel (or in whispers, if used in whispers)",
		"",

		`<code>${prefix}pingme (user) (... custom text)</code>`,
		"Same as above, but your custom text will be mentioned as well.",
		"This is useful if you want to set a note or something of that matter."
	])
};
