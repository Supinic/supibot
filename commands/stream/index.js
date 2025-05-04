import cacheKeys from "../../utils/shared-cache-keys.json" with { type: "json" };
const {
	PLAYSOUNDS_ENABLED,
	TTS_ENABLED,
	TTS_MULTIPLE_ENABLED,
	TTS_TIME_LIMIT,
	SONG_REQUESTS_STATE
} = cacheKeys;

const AVAILABLE_SONG_REQUEST_STATES = new Set(["cytube", "vlc", "off"]);

export default {
	Name: "stream",
	Aliases: null,
	Author: "supinic",
	Cooldown: 0,
	Description: "Multiple configurations regarding the stream. Mostly used for #supinic, and nobody else.",
	Flags: ["developer","mention","pipe","system","whitelist"],
	Params: null,
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
					reply: `Text to speech is now set to ${value}.`
				};
			}

			case "ttslimit": {
				const limit = Number(rest.shift());
				if (!Number.isFinite(limit) || limit < 0 || limit > 300_000) {
					return {
						reply: "Invalid value provided! Must be in the range <0, 300000>."
					};
				}

				await core.Cache.setByPrefix(TTS_TIME_LIMIT, limit);
				return {
					reply: `Text to speech time limit is now set to ${limit} milliseconds.`
				};
			}

			case "ttsmulti":
			case "multitts": {
				const value = (rest.shift() === "true");
				await core.Cache.setByPrefix(TTS_MULTIPLE_ENABLED, value);
				return {
					reply: `Concurrent text to speech is now set to ${value}`
				};
			}

			case "ps":
			case "playsounds":
			case "playsound": {
				const value = (rest.shift() === "true");
				await core.Cache.setByPrefix(PLAYSOUNDS_ENABLED, value);
				return {
					reply: `Play sounds are now set to ${value}`
				};
			}

			case "sr": {
				const value = (rest.shift() || "").toLowerCase();
				if (!AVAILABLE_SONG_REQUEST_STATES.has(value)) {
					return {
						reply: "Invalid song request state!"
					};
				}

				if (value === "vlc") {
					sb.VideoLANConnector.startClient();
				}
				else {
					sb.VideoLANConnector.stopClient();
				}

				await core.Cache.setByPrefix(SONG_REQUESTS_STATE, value);
				return {
					reply: `Song requests are now set to ${value}`
				};
			}

			default: return { reply: "Unrecognized command." };
		}
	}),
	Dynamic_Description: null
};
