import type { CronDefinition } from "../index.js";

const broadcastMessage = core.Utils.tag.trim `
	Chatterino users supiniOkay 👉
	To get binged 🔔 when Supi goes live, use !notifyme live
	or use !events to get a list of things to get binged 🔔 about
	(e.g. going live, changing title, ...)
`;

export default {
	name: "supinic-advert",
	expression: "0 30 * * * *",
	description: "Posts a reminder how to use titlechange_bot in #supinic",
	code: (async function announceSupinicAdvertisement () {
		const channelData = sb.Channel.get("supinic", "twitch");
		if (!channelData) {
			this.stop();
			return;
		}

		if (!await channelData.isLive()) {
			return;
		}

		const timeout = core.Utils.random(0, 600_000);
		setTimeout(() => void channelData.send(broadcastMessage), timeout);
	})
} satisfies CronDefinition;
