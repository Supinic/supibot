module.exports = {
	Name: "stream-silence-prevention",
	Expression: "*/5 * * * * *",
	Description: "Makes sure that there is not a prolonged period of song request silence on Supinic's stream while live.",
	Defer: null,
	Type: "Bot",
	Code: (async function preventStreamSilence () {
		if (this.data.stopped) {
			return;
		}

		this.data.repeats ??= [];
		this.data.repeatsAmount ??= 100;
		this.data.bannedLinks ??= [
			"BaMcFghlVEU", // Gachillmuchi
			"QO0CRvQ0WRA" // Gachillmuchi reupload by DJ Gachi
		];

		// early return - avoid errors during modules loading
		if (!sb.Channel || !sb.Platform || !sb.VideoLANConnector) {
			return;
		}

		const twitch = sb.Platform.get("twitch");
		const cytube = sb.Platform.get("cytube");
		const channelData = sb.Channel.get("supinic", "twitch");
		const cytubeChannelData = sb.Channel.get(49);

		// Don't autorequest when stream is offline
		const streamData = await channelData.getStreamData();
		if (!streamData.live) {
			return;
		}

		// Don't autorequest in an unsupported songrequest state
		const state = sb.Config.get("SONG_REQUESTS_STATE");
		if (state !== "vlc" && state !== "cytube") {
			return;
		}

		let repeatsArray;
		let isQueueEmpty = false;
		if (state === "vlc") {
			const queue = await sb.VideoLANConnector.getNormalizedPlaylist();
			isQueueEmpty = (queue.length === 0);

			repeatsArray = await sb.Query.getRecordset(rs => rs
				.select("Link")
				.from("chat_data", "Song_Request")
				.orderBy("ID DESC")
				.limit(this.data.repeatsAmount)
				.flat("Link")
			);
		}
		else if (state === "cytube") {
			repeatsArray = this.data.repeats;
			isQueueEmpty = (cytube.controller.clients.get(cytubeChannelData.ID).playlistData.length === 0);
		}

		// Don't autorequest if queue is not empty
		if (!isQueueEmpty) {
			return;
		}


		let link;
		let videoID;
		const roll = sb.Utils.random(1, 4);
		if (roll < 4) {
			const videoData = await sb.Query.getRecordset(rs => rs
				.select("Link", "Video_Type")
				.from("personal", "Favourite_Track")
				.where(
					{ condition: (repeatsArray.length !== 0) },
					"Link NOT IN %s+",
					repeatsArray
				)
				.orderBy("RAND()")
				.limit(1)
				.single()
			);

			const prefix = await sb.Query.getRecordset(rs => rs
				.select("Link_Prefix")
				.from("data", "Video_Type")
				.where("ID = %n", videoData.Video_Type)
				.limit(1)
				.single()
				.flat("Link_Prefix")
			);

			videoID = videoData.Link;
			link = prefix.replace("$", videoData.Link);
		}
		else {
			/** @type {string[]} */
			const links = await sb.Query.getRecordset(rs => rs
				.select("Track.Link AS Link")
				.from("music", "User_Favourite")
				.where("User_Alias = %n", 1)
				.where("Video_Type = %n", 1)
				.where(
					{ condition: (repeatsArray.length !== 0) },
					"Track.Link NOT IN %s+",
					repeatsArray
				)
				.join("music", "Track")
				.flat("Link")
			);

			videoID = sb.Utils.randArray(links);
			link = `https://youtu.be/${videoID}`;
		}

		// If the rolled video is in the banned list, exit early and repeat later
		if (this.data.bannedLinks.includes(videoID)) {
			return;
		}

		if (state === "vlc") {
			const self = await sb.User.get("supibot");
			const sr = sb.Command.get("sr");

			const fakeContext = sb.Command.createFakeContext(sr, {
				user: self,
				channel: channelData,
				platform: twitch
			});

			await sr.execute(fakeContext, link);
		}
		else if (state === "cytube") {
			const videoID = sb.Utils.modules.linkParser.parseLink(link);
			const client = cytube.controller.clients.get(cytubeChannelData.ID);

			// noinspection ES6MissingAwait
			client.queue("yt", videoID);
			repeatsArray.push(videoID);
		}
	})
};
