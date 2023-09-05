module.exports = {
	name: "Bun",
	aliases: [],
	notes: "Posts new Bun blogposts whenever one is published",
	channelSpecificMention: true,
	response: {
		added: "You will now be pinged whenever a new Bun blogpost is published.",
		removed: "You will no longer receive pings when a new Bun blogpost is published."
	},
	generic: true,
	cronExpression: "0 */5 * * * *",
	cacheKey: "bun-blogpost-last-publish-date",
	subName: "Bun blogpost",
	type: "rss",
	url: "https://bun.sh/rss.xml"
};
