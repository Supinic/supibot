import type { CronDefinition } from "../index.js";

export default {
	name: "stay-hydrated",
	expression: "0 20 * * * *",
	description: "Stay hydrated!",
	code: (async function announceStayHydrated () {
		const channelData = sb.Channel.get("supinic", "twitch");
		if (!channelData) {
			this.stop();
			return;
		}

		if (await channelData.isLive()) {
			await channelData.send("OMGScoods TeaTime Don't forget to stay hydrated!");
		}
	})
} satisfies CronDefinition;
