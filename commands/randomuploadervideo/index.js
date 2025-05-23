import { fetchYoutubePlaylist } from "../../utils/command-utils.js";
import getLinkParser from "../../utils/link-parser.js";

export default {
	Name: "randomuploadervideo",
	Aliases: ["ruv"],
	Author: "supinic",
	Cooldown: 20000,
	Description: "On Supinic's stream, takes the currently playing video (if there is any) and fetches another random video from the same YouTube uploader.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [
		{ name: "linkOnly", type: "boolean" }
	],
	Whitelist_Response: "Only usable in Supinic's channel.",
	Code: (async function randomUploaderVideo (context, ...args) {
		if (!process.env.API_GOOGLE_YOUTUBE) {
			throw new sb.Error({
				message: "No YouTube API key configured (API_GOOGLE_YOUTUBE)"
			});
		}

		const link = args.shift();
		if (!link) {
			return {
				success: false,
				reply: `No link provided!`
			};
		}

		const linkParser = await getLinkParser();
		const type = linkParser.autoRecognize(link);
		if (type === null) {
			return {
				success: false,
				reply: `Provided link was not recognized!`
			};
		}
		else if (type !== "youtube") {
			return {
				success: false,
				reply: `Provided link is not located on YouTube - cannot continue!`
			};
		}

		const linkData = await linkParser.fetchData(link);
		if (!linkData) {
			return {
				success: false,
				reply: `Provided video is not available!`
			};
		}

		const authorData = await core.Got.get("GenericAPI")({
			throwHttpErrors: false,
			responseType: "json",
			url: "https://www.googleapis.com/youtube/v3/channels",
			searchParams: {
				part: "contentDetails,snippet",
				id: linkData.authorID,
				key: process.env.API_GOOGLE_YOUTUBE
			}
		}).json();

		const playlistID = authorData?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
		if (!playlistID) {
			return {
				success: false,
				reply: `No uploads playlist found!`
			};
		}

		const { result } = await fetchYoutubePlaylist({
			limit: 50,
			limitAction: null,
			perPage: 50,
			playlistID
		});

		const playlistData = result.filter(i => i.ID !== linkData.ID);
		if (playlistData.length === 0) {
			return {
				success: false,
				reply: `There are no other videos from this uploader!`
			};
		}

		const { ID } = core.Utils.randArray(playlistData);
		if (context.params.linkOnly) {
			return {
				reply: `https://youtu.be/${ID}`
			};
		}

		const authorName = authorData?.items?.[0]?.snippet?.title ?? "(unknown)";
		return {
			reply: `Random video from ${authorName}: https://youtu.be/${ID}`
		};
	}),
	Dynamic_Description: null
};
