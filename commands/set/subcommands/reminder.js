module.exports = {
	name: "reminder",
	aliases: ["remind", "reminders"],
	parameter: "ID",
	description: "Unsets an active reminder either set by you, or for you. You can use the <code>from:(user)</code> parameter to quickly unset all timed reminders set for you by a given user.",
	flags: {
		pipe: true
	},
	getLastID: (context) => sb.Query.getRecordset(rs => rs
		.select("ID")
		.from("chat_data", "Reminder")
		.where("User_From = %n", context.user.ID)
		.orderBy("ID DESC")
		.limit(1)
		.single()
		.flat("ID")
	),
	set: () => ({
		success: false,
		reply: `Use the $remind command instead!`
	}),
	unset: async (context, ID) => {
		const row = await sb.Query.getRow("chat_data", "Reminder");
		await row.load(ID, true);

		if (!row.loaded) {
			const historyRow = await sb.Query.getRow("chat_data", "Reminder_History");
			await historyRow.load(ID, true);
			if (historyRow.loaded) {
				return {
					success: false,
					reply: "That reminder is already deactivated!"
				};
			}
			else {
				return {
					success: false,
					reply: "There is no reminder with such ID!"
				};
			}
		}
		else if (row.values.User_From !== context.user.ID && row.values.User_To !== context.user.ID) {
			return {
				success: false,
				reply: "That reminder was not created by you or set for you!"
			};
		}
		else if (context.channel?.ID && !row.values.Schedule && row.values.User_To === context.user.ID) {
			return {
				success: false,
				reply: "Good job, trying to unset a reminder that just fired PepeLaugh"
			};
		}
		else {
			const reminder = sb.Reminder.get(ID);
			if (reminder) {
				await reminder.deactivate(true, true);
			}
			else {
				await row.save({ skipLoad: true });
			}

			return {
				reply: `Reminder ID ${ID} unset successfully.`
			};
		}
	},
	userSpecificUnset: async (context) => {
		const authorUserData = await sb.User.get(context.params.from);
		if (!authorUserData) {
			return {
				success: false,
				reply: `No such user exists!`
			};
		}

		const reminderIDs = await sb.Query.getRecordset(rs => rs
			.select("ID")
			.from("chat_data", "Reminder")
			.where("Schedule IS NOT NULL")
			.where("User_From = %n", authorUserData.ID)
			.where("User_To = %n", context.user.ID)
			.flat("ID")
		);

		if (reminderIDs.length === 0) {
			return {
				success: false,
				reply: `You have no active timed reminders pending from that user!`
			};
		}

		const promises = [];
		for (const reminderID of reminderIDs) {
			const reminder = sb.Reminder.get(reminderID);
			if (!reminder) {
				continue;
			}

			promises.push(reminder.deactivate(true, true));
		}

		await Promise.all(promises);
		return {
			reply: `Successfully unset ${promises.length} timed reminders from that user.`
		};
	}
};
