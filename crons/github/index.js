module.exports = {
	Name: "github",
	Expression: "0 0 1-23/2 * * *",
	Defer: null,
	Type: "Bot",
	Code: (async function announceGithub () {
		const channelData = sb.Channel.get("supinic", "twitch");
		if (!channelData.sessionData.live) {
			await channelData.send("Node.JS developers peepoHackies check the Supibot repository miniDank 👉 https://github.com/Supinic/supibot");
		}
	})
};