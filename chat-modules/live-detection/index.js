module.exports = {
	Name: "live-detection",
	Events: ["online"],
	Description: "Sends out PMs to all users subbed to the live event, whenever a channel set up there goes live.",
	Code: (async function liveDetection (context) {
		const { channel } = context;
		const subscriptions = await sb.Query.getRecordset(rs => rs
		    .select("User_Alias", "Platform")
		    .from("chat_data", "Event_Subscription")
			.where("JSON_CONTAINS(Data, %n, %s) = %n", channel.ID, "$.channels", 1)
		);

		if (subscriptions.length === 0) {
			return;
		}

		for (const row of subscriptions) {
			const userData = await sb.User.get(row.User_Alias);
			const platformData = sb.Platform.get(row.Platform);

			platformData.pm(`Channel ${channel.Name} has just gone live! https://twitch.tv/${channel.Name}`, userData);
		}
	}),
	Author: "supinic"
};