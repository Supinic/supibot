module.exports = {
	Name: "findraidstreams",
	Aliases: ["frs"],
	Author: "supinic",
	Cooldown: 0,
	Description: "Iterates over eligible Twitch channels, finds online streams and posts a summary to Pastebin. Used to find a good raid after a stream is finished.",
	Flags: ["developer","pipe","whitelist"],
	Params: [
		{ name: "haste", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: (() => ({
		viewerThreshold: 100
	})),
	Code: (async function findRaidStreams (context) {
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
		const server = context.params.haste ?? "haste.zneix.eu";

		const response = await sb.Got("GenericAPI", {
			method: "POST",
			url: `https://${server}/documents`,
			throwHttpErrors: false,
			body: `Raid targets ${new sb.Date().format("Y-m-d H:i:s")}\n\n${data}`
		});

		if (response.statusCode !== 200) {
			return {
				success: false,
				reply: `Error ${response.statusCode} while posting paste!`
			};
		}

		return {
			reply: `https://${server}/raw/${response.body.key}`
		};
	}),
	Dynamic_Description: null
};
