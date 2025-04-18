export default {
	name: "supinic-advert",
	expression: "0 30 * * * *",
	description: "Posts a reminder how to use titlechange_bot in #supinic",
	code: (async function announceSupinicAdvertisement () {
		setTimeout(async () => {
			const channelData = sb.Channel.get("supinic", "twitch");
			if (!await channelData.isLive()) {
				return;
			}

			await channelData.send(core.Utils.tag.trim `
				Chatterino users supiniOkay 👉
				To get binged 🔔 when Supi goes live, use !notifyme live
				or use !events to get a list of things to get binged 🔔 about
				(e.g. going live, changing title, ...)
			`);
		}, Math.floor(Math.random() * 600_000));
	})
};
