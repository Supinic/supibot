const BOT_INFO_MESSAGE = sb.Utils.tag.trim `
	Starting June 26th 2024, in order to remain in a channel, Supibot will require either:
	1) The broadcaster's permission via Twitch,
	or 2) Being a moderator in the channel.
	Make sure you do either or both by the deadline.
	Permission is granted here: https://supinic.com/bot/twitch-auth
`;

export const definition = {
	name: "bot-scopes-info",
	expression: "0 35 * * * *",
	description: "Check your posture!",
	code: (async function announceStayHydrated () {
		const supinicChannel = sb.Channel.get("supinic", "twitch");

		const streamData = await supinicChannel.getStreamData();
		if (!streamData.live) {
			await supinicChannel.send(BOT_INFO_MESSAGE);
		}

		const botChannel = sb.Channel.get("supibot", "twitch");
		await botChannel.send(BOT_INFO_MESSAGE);
	})
};
