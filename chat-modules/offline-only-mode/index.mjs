export const definition = {
	Name: "offline-only-mode",
	Events: ["online", "offline"],
	Description: "Makes Supibot go into Read-only mode when the channel is online. Reverts back when the channel goes offline.",
	Code: (async function offlineOnlyMode (context) {
		const { event, channel } = context;
		const offlineConfiguration = await channel.getDataProperty("offlineOnlyBot");

		if (event === "online" && channel.Mode !== "Read" && !offlineConfiguration) {
			await context.channel.setDataProperty("offlineOnlyBot", {
				started: new sb.Date().sqlDateTime(),
				mode: channel.Mode ?? "Write"
			});

			await channel.saveProperty("Mode", "Read");
		}
		else if (event === "offline" && channel.Mode === "Read" && offlineConfiguration) {
			await context.channel.setDataProperty("offlineOnlyBot", null);
			await channel.saveProperty("Mode", offlineConfiguration.mode ?? "Write");
		}
	}),
	Global: false,
	Platform: null
};
