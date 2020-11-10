module.exports = {
	Name: "invalidate-activity-cache",
	Expression: "0 0 0 * * *",
	Description: "Periodically (every midnight) clears channel activity cache on the website.",
	Defer: null,
	Type: "Website",
	Code: (async function invalidateWebsiteActivityCache () {
		sb.App.cache.channelActivity = {};
	})
};