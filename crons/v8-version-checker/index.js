module.exports = {
	Name: "v8-version-checker",
	Expression: "0 5 */1 * * *",
	Description: "Checks new releases of V8, and if one is detected, posts about it in chat and reminds subscribed users if they're not around.",
	Defer: null,
	Type: "Bot",
	Code: (async function checkLastV8Version () {
		this.data.isTableAvailable ??= await sb.Query.isTablePresent("data", "Event_Subscription");
		if (this.data.isTableAvailable === false) {
			this.stop();
			return;
		}

		const response = await sb.Got("https://v8.dev/blog.atom");
		if (response.statusCode !== 200) {
			return;
		}

		const rssData = await sb.Utils.parseRSS(response.body);
		const [latestArticle] = rssData.items.sort((a, b) => new sb.Date(b.isoDate) - new sb.Date(a.isoDate));
		if (!latestArticle) {
			return;
		}

		const articleMatch = latestArticle.title.match(/v(\d+\.\d+)$/);
		if (!articleMatch) {
			return;
		}

		const rawVersion = sb.Config.get("LATEST_V8_VERSION");
		const dbVersion = (rawVersion === null) ? [0, 0] : rawVersion.split(".").map(Number);
		const newVersion = articleMatch[1].split(".").map(Number);

		let versionString = "";
		const newVersionString = articleMatch[1];
		if (dbVersion[0] <= newVersion[0]) {
			versionString = `New major V8 version detected!!! PagChomp 👉`;
		}
		else if (dbVersion[1] <= newVersion[1]) {
			versionString = `New minor V8 version detected! PogChamp 👉`;
		}
		else {
			return;
		}

		await sb.Config.set("LATEST_V8_VERSION", newVersion);

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

		const announcement = `${versionString} v${newVersionString} More info: ${latestArticle.link}`;
		await Promise.all(remindedUsers.map(user => (
			sb.Reminder.create({
				Channel: null,
				User_From: 1127,
				User_To: user.ID,
				Text: `${announcement} (you were not around when it was announced)`,
				Schedule: null,
				Created: new sb.Date(),
				Private_Message: true,
				Platform: 1
			}, true)
		)));

		const chatPing = pingedUsers.map(i => `@${i.Username}`).join(" ");
		await sb.Channel.get(38).send(`${chatPing} ${announcement}`);
	})
};
