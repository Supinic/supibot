module.exports = {
	Name: "downloadclip",
	Aliases: ["dlclip"],
	Author: "supinic",
	Cooldown: 30000,
	Description: "Takes a Twitch clip name, and sends a download link to it into whispers.",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function downloadClip (context, rawSlug) {
		if (!rawSlug) {
			return { reply: "No clip slug provided!" };
		}
	
		const slug = rawSlug.match(/^[a-zA-z]+$/)?.[0];
		if (!slug) {
			return {
				success: false,
				reply: "Invalid clip slug provided! Only letters are allowed."
			};
		}

		const data = await sb.Got("Leppunen", `twitch/clip/${slug}`).json();
		if (data.status === 404) {
			return {
				reply: "No data found for given slug!"
			};
		}
	
		const source = Object.entries(data.response.videoQualities).sort((a, b) => Number(a.quality) - Number(b.quality))[0][1].sourceURL;
		return {
			replyWithPrivateMessage: true,
			reply: source
		};
	}),
	Dynamic_Description: null
};