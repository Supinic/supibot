import { declare } from "../../classes/command.js";
import { getPathFromURL } from "../../utils/command-utils.js";
import { ivrClipSchema } from "../../utils/schemas.js";

export default declare({
	Name: "downloadclip",
	Aliases: ["dlclip"],
	Cooldown: 30000,
	Description: "Takes a Twitch clip link, and sends a direct download link to it into your private messages.",
	Flags: ["mention", "non-nullable", "pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function downloadClip (context, ...args) {
		if (args.length === 0) {
			return {
				success: false,
				reply: "No clip link provided!"
			};
		}

		let resultSlug;
		const legacyClipRegex = /[a-z0-9]+/i;
		const modernClipRegex = /[a-z0-9]+-[-\w]{16}/i;
		for (const arg of args) {
			const rawSlug = getPathFromURL(arg);
			if (!rawSlug) {
				continue;
			}

			const match = rawSlug.match(modernClipRegex) ?? rawSlug.match(legacyClipRegex);
			if (!match) {
				return {
					success: false,
					reply: "Invalid clip slug provided! Only letters are allowed."
				};
			}

			resultSlug = match[0];
			break;
		}

		if (resultSlug) {
			return {
				success: false,
				reply: `No proper clip link provided!`
			};
		}

		const response = await core.Got.get("IVR")({ url: `v2/twitch/clip/${resultSlug}` });
		if (response.statusCode === 400) {
			return {
				success: false,
				reply: "Invalid slug format provided! Check if you included the entire link."
			};
		}
		else if (!response.ok) {
			return {
				success: false,
				reply: "No data found for given slug! Perhaps try again in a couple of minutes."
			};
		}

		const { clip, clipKey = "" } = ivrClipSchema.parse(response.body);
		if (clip.broadcaster) {
			const [source] = clip.videoQualities.sort((a, b) => Number(b.quality) - Number(a.quality));
			await context.platform.pm(
				`${source.sourceURL}${clipKey}`,
				context.user,
				context.channel ?? null
			);

			return {
				success: true,
				reply: "I whispered you the download link 🤫"
			};
		}
		else {
			// Broadcaster is suspended, commence experimental mode
			// Extract the "clip slug" from the preview image URL, if exists
			const previewUrl = clip.tiny ?? clip.small ?? clip.medium;
			if (!previewUrl) {
				return {
					success: false,
					reply: `The streamer this clip is from is banned! Couldn't reconstruct clip URL (preview url)`
				};
			}

			const regex = /\.\w+?\/(.+?)-preview/;
			const match = previewUrl.match(regex)?.[1];
			if (!match) {
				return {
					success: false,
					reply: `The streamer this clip is from is banned! Couldn't reconstruct clip URL (no match)`
				};
			}

			const baseUrl = "https://production.assets.clips.twitchcdn.net";
			const experimentalUrl = `${baseUrl}/${match}.mp4${clipKey}`;
			await context.platform.pm(
				experimentalUrl,
				context.user,
				context.channel ?? null
			);

			return {
				success: true,
				reply: "The streamer is banned. But I whispered you an experimental download link that might just work 🤫"
			};
		}
	}),
	Dynamic_Description: null
});
