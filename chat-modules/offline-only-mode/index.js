import { SupiDate } from "supi-core";

export default {
	Name: "offline-only-mode",
	Events: ["online", "offline"],
	Description: "Makes Supibot go into Read-only mode when the channel is online. Reverts back when the channel goes offline.",
	Code: (async function offlineOnlyMode (context) {
		const { event, channel } = context;
		const offlineConfiguration = await channel.getDataProperty("offlineOnlyBot");

		if (event === "online" && channel.Mode !== "Read" && !offlineConfiguration) {
			await context.channel.setDataProperty("offlineOnlyBot", {
				started: new SupiDate().sqlDateTime(),
				mode: channel.Mode ?? "Write"
			});

			await channel.send("Offline-only mode: Stream is online, I'll be back MrDestructoid");

			await channel.saveProperty("Mode", "Read");
		}
		else if (event === "offline" && channel.Mode === "Read" && offlineConfiguration) {
			await context.channel.setDataProperty("offlineOnlyBot", null);

			await channel.saveProperty("Mode", offlineConfiguration.mode ?? "Write");

			await channel.send("Offline-only mode: Stream is offline, I'm back now MrDestructoid");
		}
	}),
	Global: false,
	Platform: null
};
