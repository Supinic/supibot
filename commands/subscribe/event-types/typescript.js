export default {
	name: "Typescript",
	aliases: ["typescript", "ts"],
	notes: "Every five minutes, Supibot checks new devblogs on Microsoft's Typescript website. If a new article is detected, you will be notified in the channel you subscribed in.",
	channelSpecificMention: true,
	response: {
		added: "You will now be pinged whenever a new Typescript devblog is published.",
		removed: "You will no longer receive pings when a new Typescript devblog is published."
	},
	generic: true,
	cronExpression: "0 */5 * * * *",
	cacheKey: "typescript-blog-last-publish-date",
	subName: "Typescript devblog",
	type: "rss",
	url: "https://devblogs.microsoft.com/typescript/feed"
};
