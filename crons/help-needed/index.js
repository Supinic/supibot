module.exports = {
	Name: "help-needed",
	Expression: "0 30 */2 * * *",
	Description: "Posts some text to spread awareness and encourage chatters to check something out. It depends..",
	Defer: null,
	Type: "Bot",
	Code: (async function announceHelpNeeded () {
		/* eslint-disable no-unreachable */
		return;

		const threshold = new sb.Date().addMinutes(-60);
		const channels = sb.Channel.getJoinableForPlatform("twitch");
		const channelStreamData = await Promise.all(channels.map(async (channel) => {
			const data = await channel.getStreamData();
			return { channel, data };
		}));

		const eligibleChannels = channelStreamData.filter(i => (
			i.channel.Platform.Name === "twitch"
			&& ["VIP", "Moderator"].includes(i.channel.Mode)
			&& !i.data.live
			&& i.channel.sessionData.lastActivity
			&& i.channel.sessionData.lastActivity.date >= threshold
		));

		let channelData;
		const cacheKey = {
			action: "help-announcement-sent",
			type: "faq-ideas"
		};

		while (!channelData && eligibleChannels.length > 0) {
			const index = sb.Utils.random(0, eligibleChannels.length);
			channelData = eligibleChannels[index];

			const announced = await channelData.getCacheData(cacheKey);
			if (announced) {
				eligibleChannels.splice(index, 1);
				channelData = null;
			}
			else {
				await channelData.setCacheData(cacheKey, { sent: sb.Date.now() }, {
					expiry: 7 * 864e5 // 1 week
				});
			}
		}

		if (!channelData) {
			console.log("No eligible help announcement targets found", { channelData, eligibleChannels });
		}
		else {
			console.log("Sending help announcement", { channelData, eligibleChannels });
			await channelData.send(sb.Utils.tag.trim `
				Supi is currently looking for ideas to put together a FAQ section about Supibot!
				If you have any ideas, or would like to see something mentioned there, make a new suggestion
				with the $suggest command, and make sure to mention "FAQ" or the suggestion "5853".
			`);
		}
	})
};
