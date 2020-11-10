module.exports = {
	Name: "discord",
	Expression: "0 0 */2 * * *",
	Description: "Posts the discord link of supinic channel",
	Defer: null,
	Type: "Bot",
	Code: (async function announceDiscordLink () {
		const channelData = sb.Channel.get("supinic", "twitch");
		if (!channelData.sessionData.live) {
			await channelData.send(channelData.Data.discord);
		}
	})
};