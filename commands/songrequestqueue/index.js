import cacheKeys from "../../utils/shared-cache-keys.json" with { type: "json" };
const { SONG_REQUESTS_STATE, SONG_REQUESTS_MPV_PAUSED } = cacheKeys;

export default {
	Name: "songrequestqueue",
	Aliases: ["srq","queue"],
	Author: "supinic",
	Cooldown: 30000,
	Description: "Posts the summary of the song request queue.",
	Flags: ["mention","pipe","whitelist"],
	Params: [],
	Whitelist_Response: "Only available in supinic's channel.",
	Code: (async function songRequestQueue (context) {
		const state = await core.Cache.getByPrefix(SONG_REQUESTS_STATE);
		if (!state || state === "off") {
			return {
				reply: "Song requests are currently turned off. Check out the history up to 14 days back: https://supinic.com/stream/song-request/history"
			};
		}
		else if (state === "cytube") {
			const command = sb.Command.get("cytube");
			if (command) {
				const result = await command.execute(context);
				return {
					reply: `Song requests are currently using Cytube. Join here: ${result.reply} :)`
				};
			}
			else {
				return {
					reply: `Song requests are currently using Cytube.`
				};
			}
		}

		const data = await sb.MpvClient.getNormalizedPlaylist();
		if (data.length === 0) {
			return {
				reply: "No songs are currently queued. Check history here: https://supinic.com/stream/song-request/history"
			};
		}

		const status = sb.MpvClient.getCurrentStatus();
		const total = data.reduce((acc, cur) => acc + cur.Duration, 0);
		const current = data.find(i => i.Status === "Current");

		const length = total - (current?.End_Time ?? status.position);
		const delta = core.Utils.timeDelta(Math.round(sb.Date.now() + length * 1000), true);

		const pauseState = await core.Cache.getByPrefix(SONG_REQUESTS_MPV_PAUSED);
		const pauseString = (pauseState === true)
			? "Song requests are paused at the moment."
			: "";

		return {
			reply: core.Utils.tag.trim `
				There are ${data.length} videos in the queue, with a total length of ${delta}.
				${pauseString} 
				Check the queue here: https://supinic.com/stream/song-request/queue
			`
		};
	}),
	Dynamic_Description: null
};
