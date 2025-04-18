const VIEWER_THRESHOLD = 100;
const BATCH_SIZE = 100;

export default {
	Name: "findraidstreams",
	Aliases: ["frs"],
	Author: "supinic",
	Cooldown: 0,
	Description: "Iterates over eligible Twitch channels, finds online streams and posts a summary to Pastebin. Used to find a good raid after a stream is finished.",
	Flags: ["developer","pipe","whitelist"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function findRaidStreams () {
		const twitch = sb.Platform.get("twitch");
		const channelIds = await twitch.getLiveChannelIdList();

		let counter = 0;
		const promises = [];
		while (counter < channelIds.length) {
			const sliceString = channelIds
				.slice(counter, counter + BATCH_SIZE)
				.map(i => `user_id=${i}`)
				.join("&");

			promises.push(
				core.Got.get("Helix")({
					url: `streams?${sliceString}`,
					responseType: "json"
				})
			);

			counter += BATCH_SIZE;
		}

		const raidData = [];
		const results = await Promise.all(promises);
		for (const partialResult of results) {
			const block = partialResult.body?.data ?? [];
			const formatted = block.map(i => ({
				name: i.user_login,
				viewers: i.viewer_count,
				game: i.game_name,
				title: i.title,
				liveFor: core.Utils.timeDelta(new sb.Date(i.started_at), true)
			}));

			raidData.push(...formatted);
		}

		const filteredRaidData = raidData
			.filter(i => i.viewers < VIEWER_THRESHOLD)
			.sort((a, b) => b.viewers - a.viewers);

		const data = JSON.stringify(filteredRaidData, null, 4);
		const response = await core.Got.get("GenericAPI")({
			method: "POST",
			url: `https://haste.zneix.eu/documents`,
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
			reply: `https://haste.zneix.eu/raw/${response.body.key}`
		};
	}),
	Dynamic_Description: null
};
