module.exports = {
	Name: "youtubesearch",
	Aliases: ["ys"],
	Author: "supinic",
	Last_Edit: "2020-10-01T15:32:02.000Z",
	Cooldown: 15000,
	Description: "Searches Youtube for video(s) with your query. Respects safe search for each platform.",
	Flags: ["mention","pipe","whitelist"],
	Whitelist_Response: "Temporarily disabled",
	Static_Data: null,
	Code: (async function youtubeSearch (context, ...args) {
		const query = args.join(" ");
		if (!query) {
			return {
				success: false,
				reply: `No query provided!`
			};
		}
	
		let safeSearch = "strict";
		if (context.platform.name === "discord") {
			if (!context.channel || context.channel.NSFW) {
				safeSearch = "off";
			}
			else {
				safeSearch = "moderate";
			}
		}
	
		const track = await sb.Utils.searchYoutube(
			query,
			sb.Config.get("API_GOOGLE_YOUTUBE"),
			{ single: true }
		);
		
		if (!track) {
			return {
				success: false,
				reply: "No videos found for that query!"
			};
		}
		else {
			return {
				reply: `https://youtu.be/${track.ID}`
			};
		}
	}),
	Dynamic_Description: null
};