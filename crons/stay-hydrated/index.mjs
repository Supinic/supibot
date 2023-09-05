export const definition = {
	name: "stay-hydrated",
	expression: "0 20 * * * *",
	description: "Stay hydrated!",
	code: (async function announceStayHydrated () {
		const channelData = sb.Channel.get("supinic", "twitch");
		const streamData = await channelData.getStreamData();

		if (streamData.live) {
			await channelData.send("OMGScoods TeaTime Don't forget to stay hydrated!");
		}
	})
};
