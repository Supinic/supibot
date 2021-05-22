module.exports = {
	Name: "songrequestqueue",
	Aliases: ["srq","queue"],
	Author: "supinic",
	Cooldown: 30000,
	Description: "Posts the summary of song request queue. EXPERIMENTAL monkaS",
	Flags: ["mention","pipe","whitelist"],
	Params: null,
	Whitelist_Response: "Only available in supinic's channel.",
	Static_Data: (() => ({
		isCustom: (string) => (string.endsWith(".mp3") || string.endsWith(".ogg") || string.endsWith(".mp4"))
	})),
	Code: (async function songRequestQueue (context) {
		const state = sb.Config.get("SONG_REQUESTS_STATE");
		if (state === "off") {
			return {
				reply: "Song requests are currently turned off. Check out the history up to 14 days back: https://supinic.com/stream/song-request/history"
			};
		}
		else if (state === "dubtrack") {
			const dubtrack = (await sb.Command.get("dubtrack").execute(context)).reply;
			return {
				reply: `Song requests are currently using dubtrack. Join here: ${dubtrack} :)`
			};
		}
		else if (state === "cytube") {
			const cytube = (await sb.Command.get("cytube").execute(context)).reply;
			return {
				reply: `Song requests are currently using Cytube. Join here: ${cytube} :)`
			};
		}

		const data = await sb.VideoLANConnector.getNormalizedPlaylist();
		if (data.length === 0) {
			return {
				reply: "No songs are currently queued. Check history here: https://supinic.com/stream/song-request/history"
			};
		}

		let status = null;
		try {
			status = await sb.VideoLANConnector.status();
		}
		catch (e) {
			if (e.message === "ETIMEDOUT") {
				return {
					reply: "VLC is not available right now!"
				};
			}
			else {
				throw e;
			}
		}

		const total = data.reduce((acc, cur) => (acc += cur.Duration), 0);
		const current = data.find(i => i.Status === "Current");

		const length = total - (current?.End_Time ?? status.time);
		const delta = sb.Utils.timeDelta(Math.round(sb.Date.now() + length * 1000), true);
		const pauseString = (sb.Config.get("SONG_REQUESTS_VLC_PAUSED"))
			? "Song requests are paused at the moment."
			: "";

		return {
			reply: sb.Utils.tag.trim `
				There are ${data.length} videos in the queue, with a total length of ${delta}.
				${pauseString} 
				Check the queue here: https://supinic.com/stream/song-request/queue
			`
		};
	}),
	Dynamic_Description: null
};
