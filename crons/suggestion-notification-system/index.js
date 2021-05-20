module.exports = {
	Name: "suggestion-notification-system",
	Expression: "0 * * * * *",
	Description: "Manages sending notifications about suggestions being changed. This is to notify users (via private system reminders) that their suggestion's status has changed.",
	Defer: null,
	Type: "Bot",
	Code: (async function notifyOnSuggestionChange () {
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
	
		if (!this.data.previousSuggestions) {
			this.data.previousSuggestions = suggestions;
			return;
		}
	
		for (const oldRow of this.data.previousSuggestions) {
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
			const githubLink = (oldRow.Github_Link === newRow.Github_Link)
				? ""
				: (oldRow.values.Github_Link === null)
					? `GitHub link added: ${newRow.Github_Link}`
					: `GitHub link modified: ${newRow.Github_Link}`;
	
			await sb.Reminder.create({
				Channel: null,
				Platform: subscription.Platform,
				User_From: sb.Config.get("SELF_ID"),
				User_To: oldRow.User_Alias,
				Text: `[EVENT] Suggestion ${oldRow.ID} changed: ${oldRow.Status ?? "(pending)"} => ${newRow.Status ?? "(pending)"} ${githubLink} Check details: ${supinicLink}`,
				Schedule: null,
				Created: new sb.Date(),
				Private_Message: true
			}, true);
		}
	
		this.data.previousSuggestions = suggestions;
	})
};