import type { CronDefinition } from "../index.js";

export default {
	name: "posture-check",
	expression: "0 50 * * * *",
	description: "Check your posture!",
	code: (async function announceStayHydrated () {
		const channelData = sb.Channel.get("supinic", "twitch");
		if (!channelData) {
			this.stop();
			return;
		}

		if (await channelData.isLive()) {
			await channelData.send("monkaS 👆 Check your posture chat");
		}
	})
} satisfies CronDefinition;
