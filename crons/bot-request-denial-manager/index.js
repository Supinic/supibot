module.exports = {
	Name: "bot-request-denial-manager",
	Expression: "*/15 * * * *",
	Description: "Sends out whispers whenever a bot request suggestion is denied. Only runs on Tuesdays",
	Defer: null,
	Type: "Bot",
	Code: (async function activeChattersLog () {
		this.data.requestIDs ??= [];

		if (this.data.requestIDs.length === 0) {
			this.data.requestIDs = await sb.Query.getRecordset(rs => rs
				.select("ID")
				.from("data", "Suggestion")
				.where("Category = %s", "Bot addition")
				.where("Status IS NULL")
				.flat("ID")
			);

			return;
		}

		const deniedRequests = await sb.Query.getRecordset(rs => rs
			.select("Suggestion.ID")
			.select("User_Alias.Name AS Username")
			.from("data", "Suggestion")
			.join({
				toDatabase: "chat_data",
				toTable: "User_Alias",
				on: "Suggestion.User_Alias = User_Alias.ID"
			})
			.where("Category = %s", "Bot addition")
			.where("Status = %s", "Denied")
			.where("Suggestion.ID IN %n+", this.data.requestIDs)
		);

		if (deniedRequests.length === 0) {
			return;
		}

		const twitchPlatform = sb.Platform.get("twitch");
		for (const request of deniedRequests) {
			const url = `https://supinic.com/data/suggestion/${request.ID}`;
			await twitchPlatform.pm(
				`Your Supibot request (ID ${request.ID}) has been denied! Check the suggestion detail for more info: ${url}`,
				request.Username
			);

			const index = this.data.requests.indexOf(request.ID);
			if (index !== -1) {
				this.data.requests.splice(index, 1);
			}
		}
	})
};
