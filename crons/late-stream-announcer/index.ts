import type { CronDefinition } from "../index.js";

export default {
	name: "late-stream-announcer",
	expression: "30 3,33 * * * *",
	description: "Checks if Supi is streaming when he should, and if not, posts a Weirdga TeaTime",
	code: (async function announceLateStream () {
		const scheduleCommand = sb.Command.get("schedule");
		if (!scheduleCommand) {
			this.stop();
			return;
		}

		const platform = sb.Platform.get("twitch");
		if (!platform) {
			this.stop();
			return;
		}

		const channel = sb.Channel.get("supinic", platform);
		if (!channel) {
			this.stop();
			return;
		}

		const botUser = await sb.User.getAsserted(platform.selfName);
		const fakeContext = sb.Command.createFakeContext(scheduleCommand, {
			platform,
			user: botUser,
			platformSpecificData: null
		});

		const result = await scheduleCommand.execute(fakeContext, "supinic");
		if (result.reply?.includes("seems to be late")) {
			await channel.send("Weirdga TeaTime @Supinic seems to be late");
		}
	})
} satisfies CronDefinition;
