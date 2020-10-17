module.exports = {
	Name: "posture-check",
	Expression: "0 50 * * * *",
	Defer: null,
	Type: "Bot",
	Code: (async function announceStayHydrated () {
		const channelData = sb.Channel.get("supinic", "twitch");
		if (channelData.sessionData.live) {
			await channelData.send("monkaS 👆 Check your posture chat");
		}
	})
};