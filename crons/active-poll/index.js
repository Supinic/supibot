module.exports = {
	Name: "active-poll",
	Expression: "0 15,45 * * * *",
	Description: "If a poll is running, announce it in chat every couple of minutes.",
	Defer: null,
	Type: "Bot",
	Code: (async function announceActivePoll () {
		const now = new sb.Date();
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