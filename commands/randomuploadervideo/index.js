module.exports = {
	Name: "randomuploadervideo",
	Aliases: ["ruv"],
	Author: "supinic",
	Cooldown: 20000,
	Description: "On supinic's stream, takes the currently playing video (if there is any) and fetches another random video from the same Youtube uploader.",
	Flags: ["link-only","mention","pipe"],
	Whitelist_Response: "Only usable in Supinic's channel.",
	Static_Data: null,
	Code: (async function randomUploaderVideo (context, ...args) {
		const link = args.shift();
		if (!link) {
			return {
				success: false,
				link: null,
				reply: `No link provided!`
			};
		}
	
		const type = sb.Utils.linkParser.autoRecognize(link);
		if (type === null) {
			return {
				success: false,
				link: null,
				reply: `Provided link was not recognized!`
			};
		}
		else if (type !== "youtube") {
			return {
				success: false,
				link: null,
				reply: `Provided link is not located on YouTube - cannot continue!`
			};
		}
	
		const linkData = await sb.Utils.linkParser.fetchData(link);
		if (!linkData) {
			return {
				success: false,
				link: null,
				reply: `Provided video is not available!`
			};
		}
	
		const authorData = await sb.Got({
			throwHttpErrors: false,
			responseType: "json",
			url: "https://www.googleapis.com/youtube/v3/channels",
			searchParams: new sb.URLParams()
				.set("part", "contentDetails,snippet")
				.set("id", linkData.authorID)
				.set("key", sb.Config.get("API_GOOGLE_YOUTUBE"))
				.toString()
		}).json();
	
		const playlistID = authorData?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
		if (!playlistID) {
			return {
				success: false,
				link: null,
				reply: `No uploads playlist found!`
			};
		}
	
		const { result } = await sb.Utils.fetchYoutubePlaylist({
			key: sb.Config.get("API_GOOGLE_YOUTUBE"),
			limit: 50,
			limitAction: null,
			perPage: 50,
			playlistID
		});
	
		const playlistData = result.filter(i => i.ID !== linkData.ID);
		if (playlistData.length === 0) {
			return {
				success: false,
				link: null,
				reply: `There are no other videos from this uploader!`
			};
		}
	
		const authorName = authorData?.items?.[0]?.snippet?.title ?? "(unknown)";
		const { ID } = sb.Utils.randArray(playlistData);
	
		return {
			link: `https://youtu.be/${ID}`,
			reply: `Random video from ${authorName}: https://youtu.be/${ID}`
		};
	}),
	Dynamic_Description: null
};