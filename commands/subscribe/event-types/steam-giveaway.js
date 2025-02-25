export default {
	name: "Steam Giveaways",
	aliases: ["steam-giveaway"],
	notes: "Every five minutes, Supibot checks for new Steam giveaways on the GamerPower website.",
	channelSpecificMention: true,
	response: {
		added: "You will now be pinged whenever a new Steam giveaway is detected.",
		removed: "You will no longer receive pings when a new Steam giveaway is detected."
	},
	generic: true,
	cronExpression: "0 */5 * * * *",
	cacheKey: "steam-giveaway-gamerpower-publish-date",
	subName: "Steam giveaway",
	type: "rss",
	url: "https://www.gamerpower.com/rss/steam"
};
