export default {
	name: "reminder",
	aliases: ["reminders"],
	description: "Shows how many times you or someone else have used reminders.",
	execute: async (context) => {
		const [liveData, historyData] = await Promise.all([
			sb.Query.getRecordset(rs => rs
				.select("SUM(Schedule IS NULL) AS Unscheduled")
				.select("SUM(Schedule IS NOT NULL) AS Scheduled")
				.from("chat_data", "Reminder")
				.where("User_From = %n", context.user.ID)
				.single()
			),
			sb.Query.getRecordset(rs => rs
				.select("SUM(Schedule IS NULL) AS Unscheduled")
				.select("SUM(Schedule IS NOT NULL) AS Scheduled")
				.from("chat_data", "Reminder_History")
				.where("User_From = %n", context.user.ID)
				.single()
			)
		]);

		const unscheduled = liveData.Unscheduled + historyData.Unscheduled;
		const scheduled = liveData.Scheduled + historyData.Scheduled;
		const total = unscheduled + scheduled;

		return {
			reply: sb.Utils.tag.trim `
				So far, you have created ${unscheduled} direct reminders
				and ${scheduled} timed reminders,
				for a total of ${total}.
			`
		};
	}
};
