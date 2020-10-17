module.exports = {
	Name: "nodejs",
	Expression: "0 0 */1 * * *",
	Defer: null,
	Type: "Bot",
	Code: (async function checkLastNodeVersion () {
		const rawData = await sb.Got.instances.GitHub({
			url: "repos/nodejs/node/releases",
		}).json();
	
		const latest = rawData.sort((a, b) => new sb.Date(b.created_at) - new sb.Date(a.created_at)).shift();
	
		if (latest.tag_name !== sb.Config.get("LATEST_NODE_JS_VERSION")) {
			console.log("New nodejs version!", sb.Config.get("LATEST_NODE_JS_VERSION"), latest.tag_name);
			sb.Config.set("LATEST_NODE_JS_VERSION", latest.tag_name);
			
			const pingedUsers = (await sb.Query.getRecordset(rs => rs
				.select("User_Alias.Name AS Username")
				.from("chat_data", "Event_Subscription")
				.join("chat_data", "User_Alias")
				.where("Type = %s", "Node.js updates")
				.where("Active = %b", true)
				.flat("Username")
			)).map(i => `@${i}`).join(" ");
			
			const channelData = sb.Channel.get(38);
			channelData.send(`${pingedUsers} New Node.js version detected! PagChomp 👉 ${latest.tag_name} Changelog: ${latest.html_url}`);
		}
	})
};