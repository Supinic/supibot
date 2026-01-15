import type { CronDefinition } from "../index.js";

export default {
	name: "supinic-tcb",
	expression: "0 0 * * * *",
	description: "Posts a small help for titlechange_bot in #supinic",
	code: (function announceSupinicTcb () {
		const channelData = sb.Channel.get("supinic", "twitch");
		if (!channelData) {
			this.stop();
			return;
		}

		const timeout = core.Utils.random(0, 600_000);
		const broadcastMessage = core.Utils.tag.trim `
			To stay up to date with all the things regarding Supibot & co.,
			make sure to follow Supinic on GitHub supiniThink 👉
			https://github.com/Supinic
			and/or join the Hackerman Club Discord supiniOkay 👉
			https://discord.gg/wHWjRzp
		`;

		setTimeout(() => void channelData.send(broadcastMessage), timeout);
	})
} as const satisfies CronDefinition;
