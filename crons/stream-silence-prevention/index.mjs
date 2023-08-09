export const definition = {
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

		// Don't auto-request when stream is offline
		const streamData = await channelData.getStreamData();
		if (!streamData.live) {
			return;
		}

		// Don't auto-request in an unsupported song-request state
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

		// Don't auto-request if the queue is not empty
		if (!isQueueEmpty) {
			return;
		}


		let link;
		let videoID;
		const roll = sb.Utils.random(1, 20);
		if (roll < 20) {
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
			/** @type {string} */
			videoID = await sb.Query.getRecordset(rs => rs
				.select("Link")
				.from("music", "Track")
				.join({
					toDatabase: "music",
					toTable: "Track_Tag",
					on: "Track_Tag.Track = Track.ID"
				})
				.where("Track.Video_Type = %n", 1)
				.where("Track_Tag.Tag = %n OR Track_Tag.Tag = %n", 6, 20)
				.where("Track.Available = %b", true)
				.where(
					{ condition: ([].length !== 0) },
					"Link NOT IN %s+",
					[]
				)
				.orderBy("RAND()")
				.single()
				.flat("Link")
			);

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
