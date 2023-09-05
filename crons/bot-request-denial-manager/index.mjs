let isTableAvailable;
let requestIDs;

export const definition = {
	name: "bot-request-denial-manager",
	expression: "*/15 * * * *",
	description: "Sends out private messages whenever a bot request suggestion is denied. Only runs on Tuesdays",
	code: (async function botRequestDenialManager () {
		isTableAvailable ??= await sb.Query.isTablePresent("data", "Suggestion");
		if (isTableAvailable === false) {
			this.job.stop();
			return;
		}

		if (!requestIDs) {
			requestIDs = await sb.Query.getRecordset(rs => rs
				.select("ID")
				.from("data", "Suggestion")
				.where("Category = %s", "Bot addition")
				.where("Status IS NULL")
				.flat("ID")
			);

			return;
		}

		const requests = await sb.Query.getRecordset(rs => rs
			.select("Suggestion.ID", "Suggestion.Status")
			.select("User_Alias.Name AS Username")
			.from("data", "Suggestion")
			.join({
				toDatabase: "chat_data",
				toTable: "User_Alias",
				on: "Suggestion.User_Alias = User_Alias.ID"
			})
			.where("Category = %s", "Bot addition")
			.where("Status IN %s+", ["Denied", "Dismissed"])
			.where("Suggestion.ID IN %n+", requestIDs)
		);

		if (requests.length === 0) {
			return;
		}

		const twitchPlatform = sb.Platform.get("twitch");
		for (const request of requests) {
			const url = `https://supinic.com/data/suggestion/${request.ID}`;
			await twitchPlatform.pm(
				`Your Supibot request (ID ${request.ID}) has been ${request.Status.toLowerCase()}! Check the suggestion detail for more info: ${url}`,
				request.Username
			);

			const index = requestIDs.indexOf(request.ID);
			if (index !== -1) {
				requestIDs.splice(index, 1);
			}
		}
	})
};
