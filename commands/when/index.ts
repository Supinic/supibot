import { SupiError } from "supi-core";
import { declare } from "../../classes/command.js";
import cacheKeys from "../../utils/shared-cache-keys.json" with { type: "json" };
const { SONG_REQUESTS_STATE, SONG_REQUESTS_MPV_PAUSED } = cacheKeys;

export default declare({
	Name: "when",
	Aliases: null,
	Author: "supinic",
	Cooldown: 15000,
	Description: "Tells you when your command is going to be played next, approximately.",
	Flags: ["mention","pipe","whitelist"],
	Params: [],
	Whitelist_Response: "Only available in channels with mpv configured!",
	Code: (async function when (context) {
		if (!sb.MpvClient) {
			return {
				success: false,
				reply: "mpv client is not available! Check configuration if this is required."
			};
		}

		const state = await core.Cache.getByPrefix(SONG_REQUESTS_STATE);
		if (state !== "mpv") {
			return {
				reply: "Song requests are currently off or not in mpv!"
			};
		}

		const playlist = await sb.MpvClient.getPlaylist();
		if (playlist.length === 0) {
			return {
				success: true,
				reply: "The playlist is currently empty."
			};
		}

		const personal = playlist.filter(i => i.user === context.user.ID);
		if (personal.length === 0) {
			return {
				success: true,
				reply: "You have no videos queued up."
			};
		}

		let prepend = "";
		let target = personal[0];
		if (target.current) {
			const name = target.description ?? target.url;
			if (personal.length === 1) {
				return {
					success: true,
					reply: `Your request "${name}" is playing right now. You don't have any other videos in the queue.`
				};
			}
			else {
				prepend = `Your request "${name}" is playing right now.`;
				target = personal[1];
			}
		}

		const status = await sb.MpvClient.getUpdatedStatus();
		if (!status.position || !status.duration) {
			throw new SupiError({
			    message: "Assert error: mpv position/duration unavailable despite non-empty playlist"
			});
		}

		let timeUntil = (status.duration - status.position);
		for (let i = 0; i < target.order; i++) {
			timeUntil += playlist[i].duration ?? 0;
		}

		const delta = core.Utils.formatTime(Math.round(timeUntil));
		const bridge = (prepend) ? "Then," : "Your next video";

		const pauseStatus = await core.Cache.getByPrefix(SONG_REQUESTS_MPV_PAUSED);
		const pauseString = (pauseStatus === true)
			? "Song requests are paused at the moment."
			: "";

		const name = target.description ?? target.url;
		return {
			reply: `${prepend} ${bridge} "${name}" is playing in ${delta}. ${pauseString}`
		};
	}),
	Dynamic_Description: null
});
