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

		// Ping if mpv is actually running
		const checkMpv = await sb.MpvClient.ping();
		if (!checkMpv) {
			return;
		}

		// Don't auto-request if the queue already has at least one thing queued
		const playlist = await sb.MpvClient.getPlaylist();
		if (playlist.length >= 1) {
			return;
		}

		// @todo port the database table into some kind of a configuration, some kidn of json array or something
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

		const name = videoData.Link.split("/").at(-1);
		const eligibleLink = `/${videoData.Link}`;
		const addResult = await sb.MpvClient.add(eligibleLink, { duration: null, name });
		if (!addResult.success) {
			return;
		}

		repeats.unshift(videoData.Link);
		repeats.splice(repeatAmount); // Clamp array to first X elements
	})
};
