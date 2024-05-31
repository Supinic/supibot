const { getLinkParser } = require("../../utils/link-parser.js");
const { searchYoutube } = require("../../utils/command-utils.js");

const CYTUBE_LIMITS = {
	TOTAL: 5,
	TIME: 600
};

module.exports = {
	queue: async function (link) {
		const linkParser = getLinkParser();
		const properLink = linkParser.autoRecognize(link);
		if (!properLink) {
			const [bestResult] = await searchYoutube(
				link.replace(/-/g, ""),
				sb.Config.get("API_GOOGLE_YOUTUBE")
			);

			if (!bestResult) {
				return {
					success: false,
					reply: `No video has been found!`
				};
			}

			link = `https://youtu.be/${bestResult.ID}`;
		}

		const linkData = await linkParser.fetchData(link);
		if (!linkData) {
			return {
				success: false,
				reply: "Link not found!"
			};
		}
		else if (linkData.duration > CYTUBE_LIMITS.TIME) {
			return {
				success: false,
				reply: `Video too long! ${linkData.duration}sec / ${CYTUBE_LIMITS.TIME}sec`
			};
		}


		const platform = sb.Platform.get("cytube");
		const channelData = sb.Channel.get(49);
		const client = platform.clients.get(channelData.ID);

		const playlist = [
			client.currentlyPlaying,
			...client.playlistData
		].filter(i => i && i.queueby?.toLowerCase() === platform.selfName);

		if (playlist.length > CYTUBE_LIMITS.TOTAL) {
			return {
				success: false,
				reply: "Too many videos queued from outside Cytube!"
			};
		}

		const cytubeType = await sb.Query.getRecordset(rs => rs
			.select("Type")
			.from("data", "Video_Type")
			.where("Parser_Name = %s", linkData.type)
			.limit(1)
			.single()
			.flat("Type")
		);
		if (!cytubeType) {
			return {
				success: false,
				reply: "Link cannot be played on Cytube!"
			};
		}

		client.queue(cytubeType, linkData.ID);
		return {
			reply: `Video ${linkData.link} "${linkData.name}" added to Cytube successfully.`
		};
	}
};
