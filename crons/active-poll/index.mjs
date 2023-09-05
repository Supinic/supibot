let isTableAvailable;

export const definition = {
	name: "active-poll",
	expression: "0 15,45 * * * *",
	description: "If a poll is running, announce it in chat every couple of minutes.",
	code: (async function announceActivePoll (cron) {
		isTableAvailable ??= await sb.Query.isTablePresent("chat_data", "Poll");
		if (isTableAvailable === false) {
			cron.job.stop();
			return;
		}

		if (!sb.Channel) {
			return;
		}

		const poll = await sb.Query.getRecordset(rs => rs
			.select("ID", "Text")
			.from("chat_data", "Poll")
			.where("Status = %s", "Active")
			.where("Start < NOW() AND End > NOW()")
			.single()
		);

		if (poll) {
			const channelData = sb.Channel.get("supinic", "twitch");
			await channelData.send(`Poll ID ${poll.ID} is currently running! Vote with "$vote yes" or "$vote no"! MEGADANK 👉 ${poll.Text}`);
		}
	})
};
