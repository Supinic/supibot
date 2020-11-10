module.exports = {
	Name: "stay-hydrated",
	Expression: "0 20 * * * *",
	Description: "Stay hydrated!",
	Defer: null,
	Type: "Bot",
	Code: (async function announceStayHydrated () {
		const channelData = sb.Channel.get("supinic", "twitch");
		if (channelData.sessionData.live) {
			await channelData.send("OMGScoots TeaTime Don't forget to stay hydrated!");
		}
	})
};