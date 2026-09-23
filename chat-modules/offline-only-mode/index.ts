import { SupiDate } from "supi-core";
import { defineChatModule } from "../../classes/chat-module.js";

export default defineChatModule({
	name: "offline-only-mode",
	description: "Makes Supibot go into Read-only mode when the channel is online. Reverts back when the channel goes offline.",
	scope: "channel",
	platform: ["twitch"],
	handlers: {
		async online (context) {
			const { channel } = context;
			const offlineConfiguration = await channel.getDataProperty("offlineOnlyBot");

			if (channel.Mode !== "Read" && !offlineConfiguration) {
				await context.channel.setDataProperty("offlineOnlyBot", {
					started: new SupiDate().sqlDateTime(),
					mode: channel.Mode
				});
			}

			await channel.send("Offline-only mode: Stream is online, I'll be back MrDestructoid");
			await channel.saveProperty("Mode", "Read");
		},
		async offline (context) {
			const { channel } = context;
			const offlineConfiguration = await channel.getDataProperty("offlineOnlyBot");

			await context.channel.setDataProperty("offlineOnlyBot", null);
			await channel.saveProperty("Mode", offlineConfiguration?.mode ?? "Write");
			await channel.send("Offline-only mode: Stream is offline, I'm back now MrDestructoid");
		}
	}
});
