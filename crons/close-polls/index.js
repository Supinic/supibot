module.exports = {
	Name: "close-polls",
	Expression: "0 0 * * * *",
	Description: "Checks for unclosed polls that have ended, and if it finds one, determines the result, and sends system reminders to everyone who voted.",
	Defer: null,
	Type: "Bot",
	Code: (async function closeActivePoll () {
		const activePoll = await sb.Query.getRecordset(rs => rs
			.select("ID")
			.from("chat_data", "Poll")
			.where("Status = %s", "Active")
			.where("End < NOW()")
			.limit(1)
			.single()
		);
	
		if (!activePoll?.ID) {
			return;
		}
	
		const row = await sb.Query.getRow("chat_data", "Poll");
		await row.load(activePoll.ID);
	
		const votes = await sb.Query.getRecordset(rs => rs
			.select("Vote", "User_Alias")
			.from("chat_data", "Poll_Vote")
			.where("Poll = %n", activePoll.ID)
		);
	
		const [yes, no] = sb.Utils.splitByCondition(votes, i => i.Vote === "Yes");
		const voteString = `${yes.length}:${no.length}`;
		if (yes.length > no.length) {
			row.values.Status = "Passed";
		}
		else {
			row.values.Status = "Failed";
		}
	
		await row.save();
		const reminders = votes.map(vote => sb.Reminder.create({
			Channel: null,
			User_From: sb.Config.get("SELF_ID"),
			User_To: vote.User_Alias,
			Text: `Poll ID ${activePoll.ID} you voted on just ended! Status: ${row.values.Status} Votes: ${voteString}`,
			Schedule: null,
			Created: new sb.Date(),
			Private_Message: true,
			Platform: 1
		}, true));
	
		await Promise.all(reminders);
	})
};