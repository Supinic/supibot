module.exports = {
	Name: "nodejs",
	Expression: "0 0 */1 * * *",
	Description: "Checks new releases of nodejs, and if one is detected, then posts it in chat.",
	Defer: null,
	Type: "Bot",
	Code: (async function checkLastNodeVersion () {
		const { handleSubscription } = require("../subscription-utils.js");
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

		if (latest.tag_name === sb.Config.get("LATEST_NODE_JS_VERSION")) {
			return;
		}

		await sb.Config.set("LATEST_NODE_JS_VERSION", latest.tag_name);

		const releaseDate = new sb.Date(latest.created_at).format("Y-m-d H:i");
		const message = `New Node.js version detected! PagChomp 👉 ${latest.tag_name}; Released on ${releaseDate}; Changelog: ${latest.html_url}`;

		await handleSubscription("Node.js updates", message);
	})
};
