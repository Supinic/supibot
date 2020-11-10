module.exports = {
	Name: "nodejs",
	Expression: "0 0 */1 * * *",
	Description: "Checks new releases of nodejs, and if one is detected, then posts it in chat.",
	Defer: null,
	Type: "Bot",
	Code: (async function checkLastNodeVersion () {
		const rawData = await sb.Got.instances.GitHub({
			url: "repos/nodejs/node/releases",
		}).json();

		const latest = rawData.sort((a, b) => new sb.Date(b.created_at) - new sb.Date(a.created_at)).shift();
		const nodeString = `New Node.js version detected! PagChomp 👉 ${latest.tag_name} Changelog: ${latest.html_url}`;

		if (latest.tag_name !== sb.Config.get("LATEST_NODE_JS_VERSION")) {
			console.log("New nodejs version!", sb.Config.get("LATEST_NODE_JS_VERSION"), latest.tag_name);
			sb.Config.set("LATEST_NODE_JS_VERSION", latest.tag_name);
			
			const userNames = await sb.Query.getRecordset(rs => rs
				.select("User_Alias.Name AS Username")
				.from("chat_data", "Event_Subscription")
				.join("chat_data", "User_Alias")
				.where("Type = %s", "Node.js updates")
				.where("Active = %b", true)
				.flat("Username")
			);

			const uncachedUsers = await Promise.all(userNames.map(async (name) => {
				const key = sb.User.createCacheKey({ name });
				const cache = await sb.Cache.getByPrefix(key);
				return (cache === null)
					? await sb.User.get(name)
					: null
			}));

			await Promise.all(uncachedUsers.map(userData => (
				sb.Reminder.create({
					Channel: null,
					User_From: 1127,
					User_To: userData.ID,
					Text: `${nodeString} (You were not around when it was announced)`,
					Schedule: null,
					Created: new sb.Date(),
					Private_Message: true,
					Platform: 1
				}, true)
			)));

			const pingedUsers = userNames.map(i => `@${i}`).join(" ");
			await sb.Channel.get(38).send(`${pingedUsers} ${nodeString}`);
		}
	})
};