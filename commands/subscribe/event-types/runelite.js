module.exports = {
	name: "Runelite",
	aliases: [],
	notes: "Every hour, supibot checks for new releases of Runelite. If a change is detected, you will be notified in  the channel you subscribed in.",
	channelSpecificMention: true,
	response: {
		added: "You will now be pinged whenever a new release of Runelite is detected.",
		removed: "You will no longer receive pings when Runelite releases an update."
	},
	generic: true,
	cronExpression: "0 */5 * * * *",
	cacheKey: "runelite-release-last-publish-date",
	subName: "Runelite version",
	type: "rss",
	url: "https://runelite.net/atom.xml"
};
