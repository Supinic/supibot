import { defineChatModule } from "../../classes/chat-module.js";

export default defineChatModule({
	name: "offline-only-mirror",
	description: "This module manages channel mirrors so that they are only in effect when the channel is offline.",
	scope: "channel",
	platform: ["twitch"],
	handlers: {
		async online (context) {
			const { event, channel } = context;
			const mirroredChannelID = await channel.getDataProperty("offlineOnlyMirror");
			const mirrorId = channel.Mirror;

			if (mirrorId === null || mirroredChannelID) {
				console.warn("Invalid combination of channel, event and mirror status", {
					channel: channel.ID,
					event,
					mirror: channel.Mirror,
					offlineOnlyMirror: mirroredChannelID
				});
				return;
			}

			// Cannot Promise.all these statements, atomicity is required
			await channel.setDataProperty("offlineOnlyMirror", mirrorId);
			await channel.saveProperty("Mirror", null);
		},
		async offline (context) {
			const { event, channel } = context;
			const mirroredChannelID = await channel.getDataProperty("offlineOnlyMirror");
			const mirrorId = channel.Mirror;

			if (mirrorId !== null || !mirroredChannelID) {
				console.warn("Invalid combination of channel, event and mirror status", {
					channel: channel.ID,
					event,
					mirror: channel.Mirror,
					offlineOnlyMirror: mirroredChannelID
				});
				return;
			}

			// Cannot Promise.all these statements, atomicity is required
			await channel.setDataProperty("offlineOnlyMirror", null);
			await channel.saveProperty("Mirror", mirroredChannelID);
		}
	}
});
