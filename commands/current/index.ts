import { declare } from "../../classes/command.js";
import cacheKeys from "../../utils/shared-cache-keys.json" with { type: "json" };
const { SONG_REQUESTS_STATE } = cacheKeys;

export default declare({
	Name: "current",
	Aliases: ["song"],
	Cooldown: 5000,
	Description: "Fetches the current song playing on stream.",
	Flags: ["developer", "mention", "pipe", "whitelist"],
	Params: [{ name: "linkOnly", type: "boolean" }] as const,
	Whitelist_Response: "This command is only available in @Supinic channel on Twitch!",
	Code: async function current (context) {
		if (!sb.MpvClient) {
			return {
				success: false,
				reply: "mpv client is not available! Check configuration if this is required."
			};
		}

		const state = await core.Cache.getByPrefix(SONG_REQUESTS_STATE) as string | undefined;
		if (!state || state === "off") {
			return {
				success: false,
				reply: "Song requests are currently turned off."
			};
		}

		const status = await sb.MpvClient.getUpdatedStatus();
		if (!status.current) {
			return {
			    success: false,
			    reply: "No videos are currently queued!"
			};
		}

		const { current } = status;
		if (context.params.linkOnly) {
			return {
			    success: true,
			    reply: current.url
			};
		}

		let requesterData = null;
		if (current.user) {
			requesterData = await sb.User.get(current.user);
		}

		const position = (status.position) ? core.Utils.round(status.position) : "(N/A)";
		const duration = (status.duration) ? core.Utils.round(status.duration) : "(N/A)";
		const positionString = `Current position: ${position}/${duration}s.`;

		const requesterUsername = requesterData?.Name ?? "(N/A)";
		const pauseString = (status.paused)
			? "The song request is paused at the moment."
			: "";

		return {
			success: true,
			reply: core.Utils.tag.trim `
				Currently playing:
				${current.name ?? current.url}
				(ID ${current.id}) - requested by ${requesterUsername}.
				${positionString}
				${pauseString}
			`
		};
	},
	Dynamic_Description: (prefix) => [
		`Checks the currently playing song on Supinic's channel/stream`,
		``,

		`<code>${prefix}song</code>`,
		`Currently playing: (link)`,
		``,

		`<code>${prefix}song linkOnly:true</code>`,
		`(link)`,
		``,

		`<code>${prefix}song previous</code>`,
		`Last played song: (link)`,
		``,

		`<code>${prefix}song next</code>`,
		`Playing next: (link)`,
		``
	]
});
