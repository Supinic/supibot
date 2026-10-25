import type { CronDefinition } from "../index.ts";

const message = [
	"To stay up to date with all the things regarding Supibot & co.,",
	"make sure to follow Supinic on GitHub supiniThink 👉",
	"https://github.com/Supinic",
	"and/or join the Hackerman Club Discord supiniOkay 👉",
	"https://discord.gg/wHWjRzp"
].join(" ");

export default {
	name: "supinic-tcb",
	expression: "0 0 * * * *",
	description: "Posts a small help for titlechange_bot in #supinic",
	code: (async function announceSupinicTcb () {
		const channelData = sb.Channel.get("supinic", "twitch");
		if (!channelData) {
			void this.stop();
			return;
		}

		const timeout = core.Utils.random(0, 300_000);
		if (!await this.delay(timeout)) {
			return;
		}

		await channelData.send(message);
	})
} satisfies CronDefinition;
