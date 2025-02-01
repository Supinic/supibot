export default {
	name: "V8",
	aliases: [],
	notes: "V8 versions",
	channelSpecificMention: true,
	response: {
		added: "You will now be pinged whenever a new V8 version is released.",
		removed: "You will no longer receive pings when a new V8 version is released"
	},
	generic: true,
	cronExpression: "0 */5 * * * *",
	cacheKey: "v8-release-last-publish-date",
	subName: "V8 version",
	type: "rss",
	url: "https://v8.dev/blog.atom"
};
