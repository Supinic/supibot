import { SupiError } from "supi-core";
import { NO_TEXT_AFK } from "../../../classes/afk.ts";
import type { Reminder } from "../../../classes/reminder.ts";
import type { CheckSubcommandDefinition } from "../index.ts";

type ReminderRow = Pick<Reminder, "ID" | "User_From" | "User_To" | "Schedule" | "Text" | "Type">;
type HistoricReminderRow = ReminderRow & { Cancelled: boolean; };

export default {
	name: "reminder",
	aliases: ["reminders"],
	title: "Reminder status and info",
	getDescription: (prefix) => [
		`<code>${prefix}check reminder (ID)</code>`,
		`Check the status and info of a reminder created by you or for you. You can use "last" instead of an ID to check the last one you made.`,
		"",

		`<code>${prefix}check reminder last</code>`,
		`Checks the last reminder you've created.`
	],
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
				success: false,
				reply: "That reminder was not created by you or for you! Stop peeking!"
			};
		}

		if (reminder.Type === "Pingme") {
			if (!reminder.User_From) {
				throw new SupiError({
					message: "Assert error: Pingme reminder has no author",
					args: { reminder }
				});
			}

			const toUserData = await sb.User.getAsserted(reminder.User_To);
			const target = (context.user.ID === reminder.User_From) ? `${toUserData.Name} types` : "you type";
			return {
				success: true,
				reply: `Pingme reminder ID ${ID} - checks when ${target} in chat. ${status}`
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
			success: true,
			reply: `${owner} ID ${ID} ${target}${delta}: ${reminder.Text ?? NO_TEXT_AFK} ${status}`
		};
	}
} satisfies CheckSubcommandDefinition;
