export const definition = {
	name: "late-stream-announcer",
	expression: "30 3,33 * * * *",
	description: "Checks if Supi is streaming when he should, and if not, posts a Weirdga TeaTime",
	code: (async function announceLateStream () {
		if (!sb.Command) {
			return;
		}

		const scheduleCommand = sb.Command.get("schedule");
		if (!scheduleCommand) {
			return;
		}

		const platform = sb.Platform.get("twitch");
		const fakeContext = sb.Command.createFakeContext(scheduleCommand, {
			platform,
			user: await sb.User.get(platform.Self_Name)
		});

		const result = await scheduleCommand.execute(fakeContext, "supinic");
		if (result.reply?.includes("seems to be late")) {
			const channel = sb.Channel.get("supinic", platform);
			await channel.send("Weirdga TeaTime @Supinic seems to be late");
		}
	})
};
