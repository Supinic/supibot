module.exports = {
	Name: "stay-hydrated",
	Expression: "0 20 * * * *",
	Description: "Stay hydrated!",
	Defer: null,
	Type: "Bot",
	Code: (async function announceStayHydrated () {
		const channelData = sb.Channel.get("supinic", "twitch");
		const streamData = await channelData.getStreamData();

		if (streamData.live) {
			await channelData.send("OMGScoods TeaTime Don't forget to stay hydrated!");
		}
	})
};