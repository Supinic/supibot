module.exports = {
	name: "reminder",
	aliases: ["reminders"],
	description: "Shows how many times you or someone else have used reminders.",
	execute: async (context) => {
		const data = await sb.Query.getRecordset(rs => rs
			.select("SUM(Schedule IS NULL) AS Unscheduled")
			.select("SUM(Schedule IS NOT NULL) AS Scheduled")
			.from("chat_data", "Reminder")
			.where("User_From = %n", context.user.ID)
			.single()
		);

		return {
			reply: sb.Utils.tag.trim `
				So far, you have created ${data.Unscheduled} direct reminders
				and ${data.Scheduled} timed reminders,
				for a total of ${data.Unscheduled + data.Scheduled}.
			`
		};
	}
};
