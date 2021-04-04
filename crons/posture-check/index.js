module.exports = {
	Name: "posture-check",
	Expression: "0 50 * * * *",
	Description: "Check your posture!",
	Defer: null,
	Type: "Bot",
	Code: (async function announceStayHydrated () {
		const channelData = sb.Channel.get("supinic", "twitch");
		const streamData = await channelData.getStreamData();

		if (streamData.live) {
			await channelData.send("monkaS 👆 Check your posture chat");
		}
	})
};