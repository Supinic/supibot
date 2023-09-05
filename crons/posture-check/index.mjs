export const definition = {
	name: "posture-check",
	expression: "0 50 * * * *",
	description: "Check your posture!",
	code: (async function announceStayHydrated () {
		const channelData = sb.Channel.get("supinic", "twitch");
		const streamData = await channelData.getStreamData();

		if (streamData.live) {
			await channelData.send("monkaS 👆 Check your posture chat");
		}
	})
};
