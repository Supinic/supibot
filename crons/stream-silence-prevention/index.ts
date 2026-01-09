import * as z from "zod";

import sharedKeys from "../../utils/shared-cache-keys.json" with { type: "json" };
import { getConfig } from "../../config.js";

const { listenerAddress, listenerPort } = getConfig().local ?? {};
const { SONG_REQUESTS_STATE } = sharedKeys;

const autoplaySchema = z.object({ link: z.string() });

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

		const response = await core.Got.get("GenericAPI")({
			url: `${listenerAddress}:${listenerPort}/?autoplay=random`
		});

		const { link } = autoplaySchema.parse(response.body);
		await sb.MpvClient.add(link, { user: null, duration: null });
	})
};
