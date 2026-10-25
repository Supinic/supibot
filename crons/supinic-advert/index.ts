import type { CronDefinition } from "../index.ts";

const message = [
	"Chatterino users supiniOkay 👉",
	"To get binged 🔔 when Supi goes live, use !notifyme live",
	"or use !events to get a list of things to get binged 🔔 about",
	"(e.g. going live, changing title, ...)"
].join(" ");

export default {
	name: "supinic-advert",
	expression: "0 30 * * * *",
	description: "Posts a reminder how to use titlechange_bot in #supinic",
	code: (async function announceSupinicAdvertisement () {
		const channelData = sb.Channel.get("supinic", "twitch");
		if (!channelData) {
			void this.stop();
			return;
		}
		if (!await channelData.isLive()) {
			return;
		}

		const timeout = core.Utils.random(0, 300_000);
		if (!await this.delay(timeout)) {
			return;
		}

		await channelData.send(message);
	})
} satisfies CronDefinition;
