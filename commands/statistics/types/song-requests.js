module.exports = {
	name: "sr",
	aliases: [],
	description: "Checks various song requests statistics on supinic's channel.",
	execute: async function execute (context, type, ...args) {
		let branch;
		let targetUser = null;
		let videoID = null;

		if (args.length === 0) {
			branch = "user";
			targetUser = context.user;
		}
		else {
			const [target] = args;
			const userCheck = await sb.User.get(target);
			if (userCheck) {
				branch = "user";
				targetUser = userCheck;
			}
			else {
				branch = "video";
				videoID = target;
			}
		}

		if (branch === "user") {
			return await this.helpers.fetchUserStats(targetUser);
		}
		else if (branch === "video") {
			return await this.helpers.fetchVideoStats(videoID);
		}
	},

	helpers: {
		fetchUserStats: async function (targetUser) {
			const requests = await sb.Query.getRecordset(rs => rs
				.select("Link", "Length", "Start_Time", "End_Time", "Video_Type")
				.from("chat_data", "Song_Request")
				.where("User_Alias = %n", targetUser.ID)
			);

			if (requests.length === 0) {
				return {
					reply: `No requested videos found.`
				};
			}

			const counter = {};
			let totalLength = 0;
			let mostRequested = null;
			let currentMax = 0;

			for (const video of requests) {
				if (typeof counter[video.Link] === "undefined") {
					counter[video.Link] = 0;
				}

				counter[video.Link]++;
				totalLength += (video.End_Time ?? video.Length) - (video.Start_Time ?? 0);
				if (currentMax < counter[video.Link]) {
					mostRequested = video;
					currentMax = counter[video.Link];
				}
			}

			const videoType = await sb.Query.getRow("data", "Video_Type");
			await videoType.load(mostRequested.Video_Type);
			const link = videoType.values.Link_Prefix.replace("$", mostRequested.Link);

			const uniques = Object.keys(counter).length;
			const total = sb.Utils.timeDelta(sb.Date.now() + totalLength * 1000, true);
			return {
				reply: sb.Utils.tag.trim `
								Videos requested: ${requests.length} (${uniques} unique), for a total runtime of ${total}.
								The most requested video is ${link} - queued ${currentMax} times.
							`
			};
		},
		fetchVideoStats: async function (videoID) {
			if (sb.Utils.modules.linkParser.autoRecognize(videoID)) {
				videoID = sb.Utils.modules.linkParser.parseLink(videoID);
			}

			const requests = await sb.Query.getRecordset(rs => rs
				.select("Added")
				.from("chat_data", "Song_Request")
				.where("Link = %s", videoID)
				.orderBy("ID DESC")
			);

			if (requests.length === 0) {
				return {
					reply: `No videos found by given ID.`
				};
			}

			const lastDelta = sb.Utils.timeDelta(requests[0].Added);
			return {
				reply: sb.Utils.tag.trim `
								This video has been requested ${requests.length} times.
								It was last requested ${lastDelta}.
							`
			};
		}
	}
};
