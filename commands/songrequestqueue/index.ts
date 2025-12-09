import { SupiDate } from "supi-core";
import { declare } from "../../classes/command.js";
import cacheKeys from "../../utils/shared-cache-keys.json" with { type: "json" };
const { SONG_REQUESTS_STATE, SONG_REQUESTS_MPV_PAUSED } = cacheKeys;

export default declare({
	Name: "songrequestqueue",
	Aliases: ["srq","queue"],
	Author: "supinic",
	Cooldown: 30000,
	Description: "Posts the summary of the song request queue.",
	Flags: ["mention","pipe","whitelist"],
	Params: [],
	Whitelist_Response: "Only available in supinic's channel.",
	Code: (async function songRequestQueue () {
		if (!sb.MpvClient) {
			return {
				success: false,
				reply: "mpv client is not available! Check configuration if this is required."
			};
		}

		const state = await core.Cache.getByPrefix(SONG_REQUESTS_STATE);
		if (!state || state === "off") {
			return {
				success: true,
				reply: "Song requests are currently turned off. Check out the history up to 14 days back: https://supinic.com/stream/song-request/history"
			};
		}

		const playlist = await sb.MpvClient.getPlaylist();
		if (playlist.length === 0) {
			return {
				success: true,
				reply: "No songs are currently queued. Check history here: https://supinic.com/stream/song-request/history"
			};
		}

		const { position } = await sb.MpvClient.getUpdatedStatus();
		const total = playlist.reduce((acc, cur) => acc + (cur.duration ?? 0), 0);

		const length = total - (position ?? 0);
		const delta = core.Utils.timeDelta(Math.round(SupiDate.now() + length * 1000), true);
		const pauseState = await core.Cache.getByPrefix(SONG_REQUESTS_MPV_PAUSED);
		const pauseString = (pauseState === true)
			? "Song requests are paused at the moment."
			: "";

		return {
			success: true,
			reply: core.Utils.tag.trim `
				There are ${playlist.length} videos in the queue, with a total length of ${delta}.
				${pauseString} 
				Check the queue here: https://supinic.com/stream/song-request/queue
			`
		};
	}),
	Dynamic_Description: null
});
