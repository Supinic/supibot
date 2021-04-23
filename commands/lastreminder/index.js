module.exports = {
	Name: "lastreminder",
	Aliases: ["lr"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches the last (already used) reminder a target user has set for you.",
	Flags: ["external-input","mention","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function lastReminder (context, user) {
		if (!user) {
			return { reply: "No user provided!" };
		}
	
		const targetUserData = await sb.User.get(user, true);
		if (!targetUserData) {
			return { reply: "That user does not exist!" };
		}
		else if (targetUserData.Name === context.platform.Self_Name) {
			return {
				reply: "I'm not your god damn calendar. Keep track of shit yourself."
			};
		}
	
		const reminder = await sb.Query.getRecordset(rs => rs
			.select("Text", "Created")
			.from("chat_data", "Reminder")
			.where("User_From = %n", targetUserData.ID)
			.where("User_To = %n", context.user.ID)
			.where("Schedule IS NULL")
			.where("Active = %b", false)
			.orderBy("Created DESC")
			.limit(1)
			.single()
		);
	
		if (!reminder) {
			return { reply: "That user has never set a non-timed reminder for you!" };
		}
		else {
			const delta = sb.Utils.timeDelta(reminder.Created);
			return {
				reply: sb.Utils.tag.trim `
					Last reminder from ${targetUserData.Name} to you:
					${reminder.Text ?? "(no message)"}
					(set ${delta})
				`
			};
		}
	}),
	Dynamic_Description: null
};