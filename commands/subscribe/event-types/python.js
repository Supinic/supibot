export default {
	name: "Python",
	aliases: ["4Head"],
	notes: "Every five minutes, Supibot checks new versions on the Python website. If a new article is detected, you will be notified in the channel you subscribed in.",
	channelSpecificMention: true,
	response: {
		added: "You will now be pinged whenever a new Python version is published.",
		removed: "You will no longer receive pings when Python is updated."
	},
	generic: true,
	cronExpression: "0 */5 * * * *",
	cacheKey: "python-release-last-publish-date",
	subName: "Python version",
	type: "rss",
	url: "https://blog.python.org/feeds/posts/default"
};
