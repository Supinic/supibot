export default {
	name: "supinic-tcb",
	expression: "0 0 * * * *",
	description: "Posts a small help for titlechange_bot in #supinic",
	code: (async function announceSupinicTCB () {
		setTimeout(async () => {
			const channelData = sb.Channel.get("supinic", "twitch");
			await channelData.send(sb.Utils.tag.trim `
				To stay up to date with all the things regarding Supibot & co.,
				make sure to follow Supinic on GitHub supiniThink 👉
				https://github.com/Supinic
				and/or join the Hackerman Club Discord supiniOkay 👉
				https://discord.gg/wHWjRzp
			`);
		}, Math.floor(Math.random() * 600_000));
	})
};
