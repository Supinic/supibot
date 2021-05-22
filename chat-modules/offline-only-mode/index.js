module.exports = {
	Name: "offline-only-mode",
	Events: ["online", "offline"],
	Description: "Makes Supibot go into Read-only mode when the channel is online. Reverts back when the channel goes offline.",
	Code: (async function offlineOnlyMode (context) {
		const { event, channel } = context;

		if (event === "online" && channel.Mode !== "Read" && !channel.Data.offlineOnlyBot) {
			channel.Data.offlineOnlyBot = {
				started: new sb.Date().sqlDateTime()
			};

			await channel.saveProperty("Data");
			await channel.saveProperty("Mode", "Read");
		}
		else if (event === "offline" && channel.Mode === "Read" && channel.Data.offlineOnlyBot) {
			delete channel.Data.offlineOnlyBot;

			await channel.saveProperty("Data");
			await channel.saveProperty("Mode", "Write");
		}
	}),
	Author: "supinic"
};
