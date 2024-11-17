const { parseRSS } = require("../../../utils/command-utils.js");

const url = "https://brightershores.pro/rss.xml";
const BRIGHTER_SHORES_LAST_UPDATE_DATE = "brighter-shores-last-update-date";

module.exports = {
	name: "Brighter Shores",
	aliases: ["BS", "brighter shores"],
	notes: "Posts update news about Brighter Shores",
	channelSpecificMention: true,
	response: {
		added: "You will now be pinged whenever a new BS update is published.",
		removed: "You will no longer receive pings when a new BS update is published."
	},
	generic: true,
	cronExpression: "0 */5 * * * *",
	subName: "BS update",
	type: "custom",
	process: async () => {
		const response = await sb.Got.get("GenericAPI")({
			url,
			responseType: "text",
			throwHttpErrors: true
		});

		if (!response.ok) {
			return;
		}

		const data = await parseRSS(response.body);
		const eligibleUpdates = data.items
			.filter(i => i.link.includes("updates"))
			.sort((a, b) => new sb.Date(b.isoDate) - new sb.Date(a.isoDate));

		const previousUpdateDateString = await sb.Cache.getByPrefix(BRIGHTER_SHORES_LAST_UPDATE_DATE)
		if (!previousUpdateDateString) {
			// If there is no date, attempt to populate the latest one, and do not post a notification (first time only)
			if (eligibleUpdates.length === 0) { // If there are no updates, do nothing and wait for a later update
				return;
			}

			await sb.Cache.setByPrefix(BRIGHTER_SHORES_LAST_UPDATE_DATE, eligibleUpdates[0].isoDate);
			return;
		}

		const previousUpdateDate = new sb.Date(previousUpdateDateString)
		const newUpdates = eligibleUpdates.filter(i => new sb.Date(i.isoDate) > previousUpdateDate);
		if (newUpdates.length === 0) { // No new updates, do nothing
			return;
		}

		await sb.Cache.setByPrefix(BRIGHTER_SHORES_LAST_UPDATE_DATE, newUpdates[0].isoDate, {
			expiry: 14 * 864e5 // 14 days
		});

		const updateString = newUpdates.map(i => `${i.title} ${i.link}`).join(" -- ");
		const noun = (newUpdates.length === 1) ? "update" : "updates";

		return {
			message: `New Brighter Shores ${noun}! ${updateString}`
		};
	}
};
