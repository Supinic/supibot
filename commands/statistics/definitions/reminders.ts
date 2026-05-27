import type { StatsSubcommandDefinition } from "../index.js";
type Data = { regular: number; scheduled: number; };

export default {
	name: "reminders",
	aliases: [],
	title: "Reminders",
	description: [],
	getDescription: (prefix) => [
		`<code>${prefix}stats reminders</code>`,
		"Shows how many times you or someone else have reminded someone."
	],
	execute: async (context, _type, username) => {
		const user = (username) ? await sb.User.get(username) : context.user;
		if (!user) {
			return {
				success: false,
				reply: "I have never seen that user before!"
			};
		}

		if (user.Name === context.platform.selfName) {
			const amount = await core.Query.getRecordset<number>(rs => rs
				.select("COUNT(*) AS amount")
				.from("chat_data", "Reminder_History")
				.where("User_From IS NULL")
				.single()
				.flat("amount")
			);

			const formatted = core.Utils.groupDigits(amount);
			return {
				success: true,
				reply: `I have delivered ${formatted} system reminders so far.`
			};
		}

		const [liveData, historyData] = await Promise.all([
			core.Query.getRecordset<Data>(rs => rs
				.select("SUM(Schedule IS NULL) AS regular")
				.select("SUM(Schedule IS NOT NULL) AS scheduled")
				.from("chat_data", "Reminder")
				.where("User_From = %n", user.ID)
				.single()
			),
			core.Query.getRecordset<Data>(rs => rs
				.select("SUM(Schedule IS NULL) AS regular")
				.select("SUM(Schedule IS NOT NULL) AS scheduled")
				.from("chat_data", "Reminder_History")
				.where("User_From = %n", user.ID)
				.single()
			)
		]);

		const verb = (context.user === user) ? "You have" : "That user has";
		const regular = liveData.regular + historyData.scheduled;
		const scheduled = liveData.regular + historyData.scheduled;
		const total = regular + scheduled;

		return {
			reply: core.Utils.tag.trim `
				${verb} created ${regular} direct reminders
				and ${scheduled} timed reminders,
				for a total of ${total}.
			`
		};
	}
} satisfies StatsSubcommandDefinition;
