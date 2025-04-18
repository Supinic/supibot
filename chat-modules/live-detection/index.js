export default {
	Name: "live-detection",
	Events: ["online"],
	Description: "Sends out PMs to all users subbed to the live event, whenever a channel set up there goes live.",
	Code: (async function liveDetection (context) {
		const { channel } = context;
		const subscriptions = await core.Query.getRecordset(rs => rs
			.select("User_Alias", "Platform")
			.from("data", "Event_Subscription")
			.where("Active = %b", true)
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
	Global: true,
	Platform: "twitch"
};
