module.exports = {
	Name: "nodejs",
	Expression: "0 0 */1 * * *",
	Description: "Checks new releases of nodejs, and if one is detected, then posts it in chat.",
	Defer: null,
	Type: "Bot",
	Code: (async function checkLastNodeVersion () {
		this.data.isTableAvailable ??= await sb.Query.isTablePresent("data", "Event_Subscription");
		if (this.data.isTableAvailable === false) {
			this.stop();
			return;
		}

		const rawData = await sb.Got("GitHub", {
			url: "repos/nodejs/node/releases"
		}).json();

		const data = rawData.sort((a, b) => new sb.Date(b.created_at) - new sb.Date(a.created_at));
		const latest = data[0];

		const releaseDate = new sb.Date(latest.created_at).format("Y-m-d H:i");
		const message = `New Node.js version detected! PagChomp 👉 ${latest.tag_name}; Changelog: ${latest.html_url}; Released on ${releaseDate}`;

		if (latest.tag_name !== sb.Config.get("LATEST_NODE_JS_VERSION")) {
			console.log("New nodejs version!", sb.Config.get("LATEST_NODE_JS_VERSION"), latest.tag_name);
			sb.Config.set("LATEST_NODE_JS_VERSION", latest.tag_name);

			const users = await sb.Query.getRecordset(rs => rs
				.select("Event_Subscription.User_Alias AS ID")
				.select("User_Alias.Name AS Username")
				.select("MAX(Meta.Last_Message_Posted) AS Last_Seen")
				.from("data", "Event_Subscription")
				.join("chat_data", "User_Alias")
				.join({
					toDatabase: "chat_data",
					toTable: "Message_Meta_User_Alias",
					alias: "Meta",
					on: "Event_Subscription.User_Alias = Meta.User_Alias"
				})
				.groupBy("Meta.User_Alias")
				.where("Type = %s", "Node.js updates")
				.where("Active = %b", true)
			);

			const now = sb.Date.now();
			const [pingedUsers, remindedUsers] = sb.Utils.splitByCondition(users, i => now - i.Last_Seen < 36e5);

			await Promise.all(remindedUsers.map(user => (
				sb.Reminder.create({
					Channel: null,
					User_From: 1127,
					User_To: user.ID,
					Text: `${message} (you were not around when it was announced)`,
					Schedule: null,
					Created: new sb.Date(),
					Private_Message: true,
					Platform: 1
				}, true)
			)));

			const chatPing = pingedUsers.map(i => `@${i.Username}`).join(" ");
			await sb.Channel.get(38).send(`${chatPing} ${message}`);
		}
	})
};
