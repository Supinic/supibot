module.exports = {
	Name: "help-needed",
	Expression: "0 30 */2 * * *",
	Description: "Posts some text to spread awareness and encourage chatters to check something out. It depends..",
	Defer: null,
	Type: "Bot",
	Code: (async function announceDiscordLink () {
		const channelData = sb.Channel.get("supinic", "twitch");
		await channelData.send(sb.Utils.tag.trim `
			Supi is currently looking for ideas to put together a FAQ section about Supibot!
			If you have any ideas, or would like to see something mentioned there, make a new suggestion
			with the $suggest command, and make sure to mention "FAQ" or the suggestion "5853".
		`);
	})
};