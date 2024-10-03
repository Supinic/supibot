let isTableAvailable;
let previousSuggestions;

export const definition = {
	name: "suggestion-notification-system",
	expression: "0 * * * * *",
	description: "Manages sending notifications about suggestions being changed. This is to notify users (via private system reminders) that their suggestion's status has changed.",
	code: (async function notifyOnSuggestionChange (cron) {
		if (typeof isTableAvailable === "undefined") {
			const [subscription, suggestion] = await Promise.all([
				sb.Query.isTablePresent("data", "Event_Subscription"),
				sb.Query.isTablePresent("data", "Suggestion")
			]);

			isTableAvailable = (subscription && suggestion);
		}

		if (isTableAvailable === false) {
			cron.job.stop();
			return;
		}

		const subscriptions = await sb.Query.getRecordset(rs => rs
			.select("User_Alias", "Platform")
			.from("data", "Event_Subscription")
			.where("Active = %b", true)
			.where("Type = %s", "Suggestion")
		);
		const users = subscriptions.map(i => i.User_Alias);

		const suggestions = await sb.Query.getRecordset(rs => rs
			.select("ID", "User_Alias", "Status")
			.from("data", "Suggestion")
			.where("Status IS NULL OR Status NOT IN %s+", ["Dismissed by author", "Quarantined"])
			.where("User_Alias IN %n+", users)
			.orderBy("ID DESC")
		);

		if (!previousSuggestions) {
			previousSuggestions = suggestions;
			return;
		}

		for (const oldRow of previousSuggestions) {
			const newRow = suggestions.find(i => i.ID === oldRow.ID);
			if (!newRow) {
				continue;
			}
			else if (oldRow.Status === newRow.Status) {
				continue;
			}

			const subscription = subscriptions.find(i => i.User_Alias === oldRow.User_Alias);
			if (!subscription) {
				continue;
			}

			const supinicLink = `https://supinic.com/data/suggestion/${newRow.ID}`;
			const extraInfoString = (oldRow.Notes === newRow.Notes)
				? `Details: ${supinicLink}`
				: `There are notes for you! Make sure you check them here: ${supinicLink}`;

			await sb.Reminder.create({
				Channel: null,
				Platform: subscription.Platform,
				User_From: null,
				User_To: oldRow.User_Alias,
				Text: `Your suggestion ${oldRow.ID} changed: is now ${newRow.Status ?? "(pending)"}. ${extraInfoString}`,
				Schedule: null,
				Created: new sb.Date(),
				Private_Message: true
			}, true);
		}

		previousSuggestions = suggestions;
	})
};
