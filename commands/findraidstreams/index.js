module.exports = {
	Name: "findraidstreams",
	Aliases: ["frs"],
	Author: "supinic",
	Cooldown: 0,
	Description: "Iterates over eligible Twitch channel, finds online streams and posts a summary to Pastebin. Used to find a good raid after a stream is finished.",
	Flags: ["developer","pipe","whitelist"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (() => ({
		viewerThreshold: 100
	})),
	Code: (async function findRaidStreams () {
		const channels = sb.Channel.getJoinableForPlatform("twitch");
		const channelStreamData = await Promise.all(channels.map(async (channel) => {
			const data = await channel.getStreamData();
			return { channel, data };
		}));

		const raidable = channelStreamData
			.filter(i => i.data.live)
			.map(i => {
				const { channel, data } = i;
				return {
					name: channel.Name,
					game: data.stream.game,
					status: data.stream.status,
					viewers: data.stream.viewers,
					online: sb.Utils.timeDelta(new sb.Date(data.stream.since), true)
				};
			})
			.filter(i => i.viewers < this.staticData.viewerThreshold)
			.sort((a, b) => b.viewers - a.viewers);

		const data = JSON.stringify(raidable, null, 4);
		const paste = await sb.Pastebin.post(data, {
			name: "Raid targets " + new sb.Date().format("Y-m-d H:i:s"),
			format: "json"
		});

		if (paste.success !== true) {
			return {
				success: false,
				reply: paste.error ?? paste.body
			};
		}

		return {
			reply: paste.body
		};
	}),
	Dynamic_Description: null
};