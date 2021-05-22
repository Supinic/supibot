module.exports = {
	Name: "downloadclip",
	Aliases: ["dlclip"],
	Author: "supinic",
	Cooldown: 30000,
	Description: "Takes a Twitch clip name or link, and sends a download link to it into whispers.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function downloadClip (context, input) {
		if (!input) {
			return {
				success: false,
				reply: "No clip provided!"
			};
		}

		const rawSlug = sb.Utils.parseURL(input).path;
		const legacyClipRegex = /[a-z]+/i;
		const modernClipRegex = /[a-z]+-[-\w]{16}/i;

		const match = rawSlug.match(modernClipRegex) ?? rawSlug.match(legacyClipRegex);
		if (!match) {
			return {
				success: false,
				reply: "Invalid clip slug provided! Only letters are allowed."
			};
		}

		const [slug] = match;
		const data = await sb.Got("Leppunen", `twitch/clip/${slug}`).json();
		if (data.status === 404) {
			return {
				success: false,
				reply: "No data found for given slug!"
			};
		}

		const [source] = Object.values(data.response.videoQualities).sort((a, b) => Number(a.quality) - Number(b.quality));
		return {
			replyWithPrivateMessage: true,
			reply: source.sourceURL
		};
	}),
	Dynamic_Description: null
};
