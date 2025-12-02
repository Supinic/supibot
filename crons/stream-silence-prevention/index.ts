// import { randomInt } from "node:crypto";
// import getLinkParser from "../../utils/link-parser.js";

import { SupiDate } from "supi-core";
import sharedKeys from "../../utils/shared-cache-keys.json" with { type: "json" };
const { SONG_REQUESTS_STATE } = sharedKeys;

const repeats: string[] = [];
const repeatAmount = 100;

export default {
	name: "stream-silence-prevention",
	expression: "*/5 * * * * *",
	description: "Makes sure that there is not a prolonged period of song request silence on Supinic's stream while live.",
	code: (async function preventStreamSilence () {
		if (!sb.MpvClient) {
			return;
		}

		// Don't auto-request when stream is offline
		const channelData = sb.Channel.getAsserted("supinic", "twitch");
		if (!await channelData.isLive()) {
			return;
		}

		// Don't auto-request outside of mpv
		const state = await core.Cache.getByPrefix(SONG_REQUESTS_STATE);
		if (state !== "mpv") {
			return;
		}

		// Don't auto-request if the queue is not empty
		const playlist = await sb.MpvClient.getPlaylist();
		if (playlist.length === 0) {
			return;
		}

		// let link;
		const videoData = await core.Query.getRecordset<{Link: string; Notes: string;}>(rs => rs
			.select("Link", "Notes")
			.from("personal", "Favourite_Track")
			.where("Video_Type = %n", 15)
			.where(
				{ condition: (repeats.length !== 0) },
				"Link NOT IN %s+",
				repeats
			)
			.orderBy("RAND()")
			.limit(1)
			.single()
		);

		const file = videoData.Link.split("\\").at(-1);
		const eligibleLink = encodeURI(`file:///${videoData.Link}`);
		const addResult = await sb.MpvClient.add(eligibleLink, { duration: null });
		if (!addResult.success) {
			return;
		}

		const queue = await sb.MpvClient.getNormalizedPlaylist();
		const row = await core.Query.getRow("chat_data", "Song_Request");
		row.setValues({
			VLC_ID: addResult.id,
			Link: videoData.Link,
			Name: file,
			Video_Type: 15,
			Length: null,
			Status: (queue.length === 0) ? "Current" : "Queued",
			Started: (queue.length === 0) ? new SupiDate() : null,
			User_Alias: 1,
			Start_Time: null,
			End_Time: null
		});
		await row.save();

		repeats.unshift(videoData.Link);
		repeats.splice(repeatAmount); // Clamp array to first X elements
	})
};
