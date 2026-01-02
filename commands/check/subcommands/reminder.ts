import { SupiError } from "supi-core";
import type { Reminder } from "../../../classes/reminder.js";
import type { CheckSubcommandDefinition } from "../index.js";

type ReminderRow = Pick<Reminder, "ID" | "User_From" | "User_To" | "Schedule" | "Text">;
type HistoricReminderRow = ReminderRow & { Cancelled: boolean; };

export default {
	name: "reminder",
	aliases: ["reminders"],
	title: "Reminder status and info",
	description: ["Check the status and info of a reminder created by you or for you. You can use \"last\" instead of an ID to check the last one you made."],
	execute: async (context, rawIdentifier) => {
		let identifier: number | string | undefined = rawIdentifier;
		if (identifier === "last") {
			identifier = await core.Query.getRecordset<number | undefined>(rs => rs
				.select("ID")
				.from("chat_data", "Reminder")
				.where("User_From = %n", context.user.ID)
				.orderBy("ID DESC")
				.limit(1)
				.single()
				.flat("ID")
			);

			// If no active reminder found, check the historic table
			identifier ??= await core.Query.getRecordset<number | undefined>(rs => rs
				.select("ID")
				.from("chat_data", "Reminder_History")
				.where("User_From = %n", context.user.ID)
				.orderBy("ID DESC")
				.limit(1)
				.single()
				.flat("ID")
			);
		}

		const ID = Number(identifier);
		if (!ID || !core.Utils.isValidInteger(ID)) {
			return {
				reply: core.Utils.tag.trim `
					Check all of your reminders here (requires login):
					Active - https://supinic.com/bot/reminder/list
					History - https://supinic.com/bot/reminder/history
				`
			};
		}

		// Load active reminder
		let row = await core.Query.getRow<ReminderRow>("chat_data", "Reminder");
		await row.load(ID, true);

		// If active reminder does not exist, fall back to historic table
		let status = "";
		if (!row.loaded) {
			const historicRow = await core.Query.getRow<HistoricReminderRow>("chat_data", "Reminder_History");
			await historicRow.load(ID, true);

			status = (historicRow.valuesObject.Cancelled) ? "(cancelled)" : "(inactive)";
			row = historicRow;
		}

		// If still nothing exists, error out
		if (!row.loaded) {
			return {
				success: false,
				reply: "That reminder doesn't exist!"
			};
		}

		const reminder = row.valuesObject;
		if (reminder.User_From !== context.user.ID && reminder.User_To !== context.user.ID) {
			return {
				reply: "That reminder was not created by you or for you. Stop peeking!"
			};
		}

		let owner;
		let target;
		if (!reminder.User_From) { // System reminder
			owner = "System reminder";
			target = "to you";
		}
		else {
			const reminderUser = (context.user.ID === reminder.User_From)
				? await sb.User.get(reminder.User_To, true)
				: await sb.User.get(reminder.User_From, true);

			if (!reminderUser) {
				throw new SupiError({
				    message: "Assert error: Reminder owner does not exist",
					args: { reminder }
				});
			}

			[owner, target] = (context.user.ID === reminder.User_From)
				? ["Your reminder", `to ${reminderUser.Name}`]
				: ["Reminder", `by ${reminderUser.Name} to you`];
		}

		const delta = (reminder.Schedule)
			? ` (${core.Utils.timeDelta(reminder.Schedule)})`
			: "";

		return {
			reply: `${owner} ID ${ID} ${target}${delta}: ${reminder.Text} ${status}`
		};
	}
} satisfies CheckSubcommandDefinition;
