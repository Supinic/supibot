module.exports = {
	Name: "supinic-advert",
	Expression: "0 30 * * * *",
	Description: "Posts a reminder how to use titlechange_bot in #supinic",
	Defer: {
		"start": 0,
		"end": 600000
	},
	Type: "Bot",
	Code: (async function announceSupinicAdvertisement () {
		const channelData = sb.Channel.get("supinic", "twitch");
		const streamData = await channelData.getStreamData();
		if (!streamData.live) {
			return;
		}

		await channelData.send(sb.Utils.tag.trim `
			Chatterino users supiniOkay 👉
			To get binged 🔔 when Supi goes live, use !notifyme live
			or use !events to get a list of things to get binged 🔔 about
			(e.g. going live, changing title, ...)
		`);
	})
};