import { declare } from "../../classes/command.js";
import cacheKeys from "../../utils/shared-cache-keys.json" with { type: "json" };

const { PLAYSOUNDS_ENABLED, TTS_ENABLED, SONG_REQUESTS_STATE } = cacheKeys;
const AVAILABLE_SONG_REQUEST_STATES = new Set(["mpv", "off"]);

export default declare({
	Name: "stream",
	Aliases: null,
	Cooldown: 0,
	Description: "Multiple configurations regarding the stream. Mostly used for #supinic, and nobody else.",
	Flags: ["developer","mention","pipe","system","whitelist"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function stream (context, type, ...rest) {
		if (!type) {
			return {
				success: false,
				reply: "Pick a command first."
			};
		}

		type = type.toLowerCase();

		switch (type) {
			case "tts": {
				const value = (rest.shift() === "true");
				await core.Cache.setByPrefix(TTS_ENABLED, value);

				return {
					success: true,
					reply: `Text to speech is now set to ${value}.`
				};
			}

			case "ps":
			case "playsound":
			case "playsounds": {
				const value = (rest.shift() === "true");
				await core.Cache.setByPrefix(PLAYSOUNDS_ENABLED, value);
				return {
					success: true,
					reply: `Play sounds are now set to ${value}`
				};
			}

			case "sr": {
				const value = (rest.shift() || "").toLowerCase();
				if (!AVAILABLE_SONG_REQUEST_STATES.has(value)) {
					return {
						success: false,
						reply: "Invalid song request state!"
					};
				}

				await core.Cache.setByPrefix(SONG_REQUESTS_STATE, value);
				if (value === "mpv" && sb.MpvClient) {
					void sb.MpvClient.ping();
				}

				return {
					success: true,
					reply: `Song requests are now set to ${value}`
				};
			}
		}

		return {
			success: false,
			reply: "Unrecognized command!"
		};
	}),
	Dynamic_Description: null
});
