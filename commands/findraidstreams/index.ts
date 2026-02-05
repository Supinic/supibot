import { SupiDate } from "supi-core";
import { declare } from "../../classes/command.js";
import { twitchStreamSchema } from "../../utils/schemas.js";
import { postToHastebin } from "../../utils/command-utils.js";

const VIEWER_THRESHOLD = 100;
const BATCH_SIZE = 100;

export default declare({
	Name: "findraidstreams",
	Aliases: ["frs"],
	Cooldown: 120000,
	Description: "Iterates over eligible Twitch channels, finds online streams and posts a summary to Hastebin. Used to find a good raid after a stream is finished.",
	Flags: ["developer", "pipe", "whitelist"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function findRaidStreams () {
		const twitch = sb.Platform.getAsserted("twitch");
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
			const block = twitchStreamSchema.parse(partialResult.body).data;
			const formatted = block.map(i => ({
				name: i.user_login,
				viewers: i.viewer_count,
				game: i.game_name,
				title: i.title,
				liveFor: core.Utils.timeDelta(new SupiDate(i.started_at), true)
			}));

			raidData.push(...formatted);
		}

		const filteredRaidData = raidData
			.filter(i => i.viewers < VIEWER_THRESHOLD)
			.sort((a, b) => b.viewers - a.viewers);

		const data = JSON.stringify(filteredRaidData, null, 4);
		const hasteResult = await postToHastebin(data, {
			title: `Raid targets ${new SupiDate().format("Y-m-d H:i:s")}`
		});

		if (!hasteResult.ok) {
			return {
				success: false,
				reply: `Could not post paste! ${hasteResult.statusCode}`
			};
		}

		return {
			success: true,
			reply: `https://haste.zneix.eu/raw/${hasteResult.link}`
		};
	}),
	Dynamic_Description: null
});
