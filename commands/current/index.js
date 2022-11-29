module.exports = {
	Name: "current",
	Aliases: ["song"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Fetches the current song playing on stream.",
	Flags: ["developer","mention","pipe","whitelist"],
	Params: [
		{ name: "linkOnly", type: "boolean" }
	],
	Whitelist_Response: "This command is only available in @Supinic channel on Twitch!",
	Static_Data: (() => ({
		types: ["current", "previous", "next"]
	})),
	Code: (async function current (context, ...args) {
		const linkSymbol = sb.Config.get("VIDEO_TYPE_REPLACE_PREFIX");
		const state = sb.Config.get("SONG_REQUESTS_STATE");

		if (state === "off") {
			return {
				reply: "Song requests are currently turned off."
			};
		}
		else if (state === "vlc-read") {
			const item = sb.VideoLANConnector.currentPlaylistItem;
			if (!item) {
				return {
					reply: "Nothing is currently playing."
				};
			}

			let leaf = item;
			while (leaf.type !== "leaf" && leaf.children.length > 0) {
				leaf = leaf.children[0];
			}

			return {
				reply: `Currently playing: ${leaf.name}`
			};
		}
		else if (state === "cytube") {
			const { controller } = sb.Platform.get("cytube");
			const channelData = sb.Channel.get(49);

			const client = controller.clients.get(channelData.ID);
			const playing = client.currentlyPlaying ?? client.playlistData[0];

			if (!playing) {
				return {
					reply: "Nothing is currently playing on Cytube."
				};
			}

			const media = playing.media;
			const prefix = await sb.Query.getRecordset(rs => rs
				.select("Link_Prefix")
				.from("data", "Video_Type")
				.where("Type = %s", media.type)
				.limit(1)
				.single()
				.flat("Link_Prefix")
			);

			const link = prefix.replace(linkSymbol, media.id);
			if (context.params.linkOnly) {
				return {
					reply: link
				};
			}

			const requester = playing.user ?? playing.queueby ?? "(unknown)";
			return {
				reply: `Currently playing on Cytube: ${media.title} ${link} (${media.duration}), queued by ${requester}`
			};
		}

		let type = (context.invocation === "current")
			? "current"
			: (args.shift() ?? "current");

		if (!this.staticData.types.includes(type)) {
			type = "current";
		}

		let includePosition = false;
		let introductionString = null;

		const playing = await sb.Query.getRecordset(rs => {
			rs.select("Name", "VLC_ID", "Link", "User_Alias AS User", "Start_Time", "End_Time")
				.select("Video_Type.Link_Prefix AS Prefix")
				.from("chat_data", "Song_Request")
				.join({
					toDatabase: "data",
					toTable: "Video_Type",
					on: "Video_Type.ID = Song_Request.Video_type"
				})
				.limit(1)
				.single();

			if (type === "previous") {
				introductionString = "Previously played:";
				rs.where("Status = %s", "Inactive");
				rs.orderBy("Song_Request.ID DESC");
			}
			else if (type === "current") {
				includePosition = true;
				introductionString = "Currently playing:";
				rs.where("Status = %s", "Current");
			}
			else if (type === "next") {
				introductionString = "Playing next:";
				rs.where("Status = %s", "Queued");
				rs.orderBy("Song_Request.ID ASC");
			}

			return rs;
		});

		if (playing) {
			const link = playing.Prefix.replace(linkSymbol, playing.Link);
			if (context.params.linkOnly) {
				return {
					reply: link
				};
			}

			const userData = await sb.User.get(playing.User);
			const { length, time } = await sb.VideoLANConnector.status();

			let currentPosition = time;
			let segmentLength = length;
			if (playing.Start_Time || playing.End_Time) {
				currentPosition = time - (playing.Start_Time ?? 0);
				segmentLength = (playing.End_Time ?? length) - (playing.Start_Time ?? 0);
			}

			let position = "";
			if (includePosition) {
				if (currentPosition === -1) {
					position = "The song is currently being queued, but hasn't started playing yet.";
				}
				else {
					position = `Current position: ${currentPosition}/${segmentLength}s.`;
				}
			}

			const pauseString = (sb.Config.get("SONG_REQUESTS_VLC_PAUSED"))
				? "The song request is paused at the moment."
				: "";

			return {
				reply: sb.Utils.tag.trim `
					${introductionString}
					${playing.Name}
					(ID ${playing.VLC_ID}) - requested by ${userData.Name}.
					${position}
					${link}
					${pauseString}
				`
			};
		}
		else {
			const string = (type === "next") ? "queued up" : "currently being played";
			return {
				success: false,
				reply: `No video is ${string}.`
			};
		}
	}),
	Dynamic_Description: (async (prefix) => [
		`Checks the currently playinyg song on Supinic's channel/stream`,
		``,

		`<code>${prefix}song</code>`,
		`Currently playing: (link)`,
		``,

		`<code>${prefix}song linkOnly:true</code>`,
		`(link)`,
		``,

		`<code>${prefix}song previous</code>`,
		`Last played song: (link)`,
		``,

		`<code>${prefix}song next</code>`,
		`Playing next: (link)`,
		``
	])
};
