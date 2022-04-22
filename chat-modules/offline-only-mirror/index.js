module.exports = {
	Name: "offline-only-mirror",
	Events: ["online", "offline"],
	Description: "This module manages channel mirrors so that they are only in effect when the channel is offline.",
	Code: (async function offlineOnlyMirror (context) {
		const { event, channel } = context;
		const mirroredChannelID = await channel.getDataProperty("offlineOnlyMirror");

		if (event === "online" && channel.Mirror !== null && !mirroredChannelID) {
			// Cannot Promise.all these statements, atomicity is required
			await channel.setDataProperty("offlineOnlyBot", channel.Mirror);
			await channel.saveProperty("Mirror", null);
		}
		else if (event === "offline" && channel.Mirror === null && mirroredChannelID) {
			await channel.setDataProperty("offlineOnlyBot", null);
			await channel.saveProperty("Mirror", mirroredChannelID);
		}
		else {
			console.warn("Invalid combination of channel, event and mirror status", {
				channel: channel.ID,
				event,
				mirror: channel.Mirror,
				offlineOnlyMirror: mirroredChannelID
			});
		}
	}),
	Global: false,
	Platform: null
};
