let isTableAvailable;
const trackedRequestIDs = new Set();

export default {
	name: "bot-request-denial-manager",
	expression: "*/15 * * * *",
	description: "Sends out private messages whenever a bot request suggestion is denied. Only runs on Tuesdays",
	code: (async function botRequestDenialManager (cron) {
		isTableAvailable ??= await sb.Query.isTablePresent("data", "Suggestion");
		if (isTableAvailable === false) {
			cron.job.stop();
			return;
		}

		const unresolvedRequestIDs = await sb.Query.getRecordset(rs => rs
			.select("ID")
			.from("data", "Suggestion")
			.where("Category = %s", "Bot addition")
			.where("Status IS NULL")
			.flat("ID")
		);

		if (unresolvedRequestIDs.length !== 0) {
			for (const item of unresolvedRequestIDs) {
				trackedRequestIDs.add(item);
			}
		}

		if (trackedRequestIDs.size === 0) {
			return;
		}

		const resolvedRequests = await sb.Query.getRecordset(rs => rs
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
			.where("Suggestion.ID IN %n+", [...trackedRequestIDs])
		);

		if (resolvedRequests.length === 0) {
			return;
		}

		const twitchPlatform = sb.Platform.get("twitch");
		for (const request of resolvedRequests) {
			const url = `https://supinic.com/data/suggestion/${request.ID}`;
			const userData = await sb.User.get(request.Username);

			await twitchPlatform.pm(
				`Your Supibot request (ID ${request.ID}) has been ${request.Status.toLowerCase()}! Check the suggestion detail for more info: ${url}`,
				userData
			);

			trackedRequestIDs.delete(request.ID);
		}
	})
};
