module.exports = {
	Name: "supinic-tcb",
	Expression: "0 0 * * * *",
	Description: "Posts a small help for titlechange_bot in #supinic",
	Defer: {
		"start": 0,
		"end": 600000
	},
	Type: "Bot",
	Code: (async function announceSupinicTCB () {
		const channelData = sb.Channel.get("supinic", "twitch");
		await channelData.send(sb.Utils.tag.trim `
			To stay up to date with all the things regarding Supibot & co.,
			make sure to follow Supinic on GitHub supiniThink 👉
			https://github.com/Supinic
			and/or join the Hackerman Club Discord supiniOkay 👉
			https://discord.gg/wHWjRzp
		`);
	})
};