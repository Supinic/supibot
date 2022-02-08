module.exports = {
	Name: "offline-only-mirror",
	Events: ["online", "offline"],
	Description: "This module manages channel mirrors so that they are only in effect when the channel is offline.",
	Code: (async function offlineOnlyMirror (context) {
		const { event, channel } = context;

		if (event === "online" && channel.Mirror !== null && !channel.Data.offlineOnlyMirror) {
			channel.Data.offlineOnlyMirror = channel.Mirror;

			await channel.saveProperty("Data");
			await channel.saveProperty("Mirror", null);
		}
		else if (event === "offline" && channel.Mirror === null && channel.Data.offlineOnlyMirror) {
			const mirror = channel.Data.offlineOnlyMirror;
			delete channel.Data.offlineOnlyMirror;

			await channel.saveProperty("Data");
			await channel.saveProperty("Mirror", mirror);
		}
		else {
			console.warn("Invalid combination of channel, event and mirror status", {
				channel: channel.ID,
				event,
				mirror: channel.Mirror,
				offlineOnlyMirror: channel.Data.offlineOnlyMirror
			});
		}
	}),
	Global: false,
	Platform: null
};
