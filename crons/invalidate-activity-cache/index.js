module.exports = {
	Name: "invalidate-activity-cache",
	Expression: "0 0 0 * * *",
	Defer: null,
	Type: "Website",
	Code: (async function invalidateWebsiteActivityCache () {
		sb.App.cache.channelActivity = {};
	})
};