module.exports = {
	Name: "runelite-version-updater",
	Expression: "0 0 */1 * * *",
	Description: "Checks new releases of nodejs, and if one is detected, then posts it in chat.",
	Defer: null,
	Type: "Bot",
	Code: (async function checkLastRuneliteVersion () {
		const { handleSubscription } = require("../subscription-utils.js");
		this.data.isTableAvailable ??= await sb.Query.isTablePresent("data", "Event_Subscription");
		if (this.data.isTableAvailable === false) {
			this.stop();
			return;
		}

		const response = await sb.Got("GenericAPI", {
			url: "https://runelite.net/atom.xml",
			responseType: "text"
		});

		if (response.statusCode !== 200) {
			return;
		}

		const xml = response.body;
		const releaseData = await sb.Utils.parseRSS(xml);

		const configReleaseDate = sb.Config.get("LATEST_RUNELITE_RELEASE_DATE");
		const lastReleaseDate = (configReleaseDate !== null)
			? new sb.Date(configReleaseDate)
			: new sb.Date(0);

		const sortedReleaseData = releaseData.sort((a, b) => new sb.Date(b.isoDate) - new sb.Date(a.isoDate));
		const currentRelease = sortedReleaseData[0];
		const currentReleaseDate = new sb.Date(currentRelease.isoDate);

		if (currentReleaseDate <= lastReleaseDate) {
			return;
		}

		const message = `New Runelite version detected! PagChomp 👉 ${currentRelease.title} - ${currentRelease.summary}. Link: ${currentRelease.link}`;
		await sb.Config.set("LATEST_RUNELITE_RELEASE_DATE", currentReleaseDate.valueOf());

		await handleSubscription("runelite", message);
	})
};
