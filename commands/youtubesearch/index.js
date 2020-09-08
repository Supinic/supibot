module.exports = {
	Name: "youtubesearch",
	Aliases: ["ys"],
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 15000,
	Description: "Searches Youtube for video(s) with your query. Respects safe search for each platform.",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
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
	
		const list = await sb.Utils.searchYoutube(
			query,
			sb.Config.get("API_GOOGLE_YOUTUBE"),
			{ 
				safeSearch
			}
		);
		
		if (list.length === 0) {
			return {
				success: false,
				reply: "No videos found for that query!"
			};
		}
		else {
			const [video] = list;
			return {
				reply: `https://youtu.be/${video.ID}`
			};
		}
	}),
	Dynamic_Description: null
};