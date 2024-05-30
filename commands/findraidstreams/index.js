const VIEWER_THRESHOLD = 100;

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
	Static_Data: null,
	Code: (async function findRaidStreams (context) {
		const channels = sb.Channel.getJoinableForPlatform("twitch")
			.map(i => i.Specific_ID)
			.filter(Boolean);

		let counter = 0;
		const promises = [];
		const batchSize = 100;
		while (counter < channels.length) {
			const sliceString = channels
				.slice(counter, counter + batchSize)
				.map(i => `user_id=${i}`)
				.join("&");

			promises.push(
				sb.Got("Helix", {
					url: `streams?${sliceString}`,
					responseType: "json"
				})
			);

			counter += batchSize;
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
				liveFor: sb.Utils.timeDelta(new sb.Date(i.started_at), true)
			}));

			raidData.push(...formatted);
		}

		const filteredRaidData = raidData
			.filter(i => i.viewers < VIEWER_THRESHOLD)
			.sort((a, b) => b.viewers - a.viewers);

		const data = JSON.stringify(filteredRaidData, null, 4);
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
