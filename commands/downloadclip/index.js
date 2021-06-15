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
		const legacyClipRegex = /[a-z0-9]+/i;
		const modernClipRegex = /[a-z0-9]+-[-\w]{16}/i;

		const match = rawSlug.match(modernClipRegex) ?? rawSlug.match(legacyClipRegex);
		if (!match) {
			return {
				success: false,
				reply: "Invalid clip slug provided! Only letters are allowed."
			};
		}

		const [slug] = match;
		const response = await sb.Got("Leppunen", `v2/twitch/getClip/${slug}`);
		if (response.statusCode === 404) {
			return {
				success: false,
				reply: "No data found for given slug!"
			};
		}

		const { clip, clipKey = "" } = response.body;
		const [source] = clip.videoQualities.sort((a, b) => Number(b.quality) - Number(a.quality));

		await context.platform.pm(
			`${source.sourceURL}${clipKey}`,
			context.user.Name,
			context.channel ?? null
		);

		return {
			reply: "OK."
		};
	}),
	Dynamic_Description: null
};
