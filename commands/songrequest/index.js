const { getLinkParser } = require("../../utils/link-parser.js");
const { searchYoutube } = require("../../utils/command-utils.js");
const CytubeIntegration = require("./cytube-integration.js");

const REQUEST_TIME_LIMIT = 900;
const REQUEST_AMOUNT_LIMIT = 10;

const fetchVimeoData = async (query) => {
	const response = await sb.Got("GenericAPI", {
		url: "https://api.vimeo.com/videos",
		throwHttpErrors: false,
		headers: {
			Authorization: `Bearer ${sb.Config.get("VIMEO_API_KEY")}`
		},
		searchParams: {
			query,
			per_page: "1",
			sort: "relevant",
			direction: "desc"
		}
	});

	if (!response.ok) {
		return {
			success: false,
			reply: `Vimeo API failed with code ${response.statusCode}! Try again later.`
		};
	}
	else {
		return {
			success: true,
			data: response.body.data ?? []
		};
	}
};

const checkLimits = (userData, playlist) => {
	const userRequests = playlist.filter(i => i.User_Alias === userData.ID);
	if (userRequests.length >= REQUEST_AMOUNT_LIMIT) {
		return {
			canRequest: false,
			reason: `Maximum amount of videos queued! (${userRequests.length}/${REQUEST_AMOUNT_LIMIT})`
		};
	}

	let totalTime = 0;
	for (const request of userRequests) {
		totalTime += (request.End_Time ?? request.Length) - (request.Start_Time ?? 0);
	}

	totalTime = Math.ceil(totalTime);

	return {
		canRequest: true,
		totalTime,
		requests: userRequests.length,
		reason: null,
		time: REQUEST_TIME_LIMIT,
		amount: REQUEST_AMOUNT_LIMIT
	};
};

const parseTimestamp = (linkParser, string) => {
	const type = linkParser.autoRecognize(string);
	if (type === "youtube" && string.includes("t=")) {
		const { parse } = require("node:url");
		let { query } = parse(string);

		if (/t=\d+/.test(query)) {
			query = query.replace(/(t=\d+\b)/, "$1sec");
		}

		return sb.Utils.parseDuration(query, { target: "sec" });
	}
};

module.exports = {
	Name: "songrequest",
	Aliases: ["sr"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Requests a song to play on Supinic's stream. You can use \"start:\" and \"end:\" to request parts of a song using seconds or a time syntax. \"start:100\" or \"end:05:30\", for example.",
	Flags: ["mention","pipe","whitelist"],
	Params: [
		{ name: "start", type: "string" },
		{ name: "end", type: "string" },
		{ name: "type", type: "string" }
	],
	Whitelist_Response: "Only available in supinic's channel.",
	Code: (async function songRequest (context, ...args) {
		if (args.length === 0) {
			// If we got no args, just redirect to $current 4HEad
			return await sb.Command.get("current").execute(context);
		}

		// Figure out whether song request are available, and where specifically
		const state = sb.Config.get("SONG_REQUESTS_STATE");
		if (state === "off") {
			return { reply: "Song requests are currently turned off." };
		}
		else if (state === "vlc-read") {
			return { reply: `Song requests are currently read-only. You can check what's playing with the "current" command, but not queue anything.` };
		}
		else if (state === "dubtrack") {
			const dubtrack = (await sb.Command.get("dubtrack").execute(context)).reply;
			return { reply: `Song requests are currently using dubtrack. Join here: ${dubtrack} :)` };
		}
		else if (state === "cytube") {
			if (!sb.Config.get("EXTERNAL_CYTUBE_SR_ENABLED", false)) {
				const cytube = (await sb.Command.get("cytube").execute(context)).reply;
				return {
					reply: `Song requests are currently using Cytube. Join here: ${cytube} :)`
				};
			}

			return await CytubeIntegration.queue(args.join(" "));
		}

		// Determine the user's and global limits - both duration and video amount
		const queue = await sb.VideoLANConnector.getNormalizedPlaylist();
		const limits = checkLimits(context.user, queue);
		if (!limits.canRequest) {
			return {
				reply: limits.reason
			};
		}

		// Determine requested video segment, if provided via the `start` and `end` parameters
		/** @type {number|null} */
		let startTime = (context.params.start) ? sb.Utils.parseVideoDuration(context.params.start) : null;
		if (startTime !== null && (!Number.isFinite(startTime) || startTime > 2 ** 32)) {
			return {
				success: false,
				reply: "Invalid start time provided!"
			};
		}

		/** @type {number|null} */
		let endTime = (context.params.end) ? sb.Utils.parseVideoDuration(context.params.end) : null;
		if (endTime !== null && (!Number.isFinite(endTime) || endTime > 2 ** 32)) {
			return {
				success: false,
				reply: "Invalid end time provided!"
			};
		}

		// Determine the video URL, based on the type of link provided
		let url = args.join(" ");
		const linkParser = getLinkParser();
		const type = context.params.type ?? "youtube";
		const potentialTimestamp = parseTimestamp(linkParser, url);

		if (potentialTimestamp && startTime === null) {
			startTime = potentialTimestamp;
		}

		const parsedURL = require("node:url").parse(url);
		let data = null;

		if (parsedURL.host === "supinic.com" && parsedURL.path.includes("/track/detail")) {
			const videoTypePrefix = sb.Config.get("VIDEO_TYPE_REPLACE_PREFIX");
			const songID = Number(parsedURL.path.match(/(\d+)/)[1]);
			if (!songID) {
				return { reply: "Invalid link!" };
			}

			let songData = await sb.Query.getRecordset(rs => rs
				.select("Available", "Link", "Name", "Duration")
				.select("Video_Type.Link_Prefix AS Prefix")
				.from("music", "Track")
				.join("data", "Video_Type")
				.where("Track.ID = %n", songID)
				.where("Available = %b", true)
				.single()
			);

			if (!songData) {
				let targetID = null;
				const main = await sb.Query.getRecordset(rs => rs
					.select("Track.ID", "Available", "Link", "Name", "Duration")
					.select("Video_Type.Link_Prefix AS Prefix")
					.from("music", "Track")
					.join("data", "Video_Type")
					.join({
						toTable: "Track_Relationship",
						on: "Track_Relationship.Track_To = Track.ID"
					})
					.where("Relationship = %s", "Reupload of")
					.where("Track_From = %n", songID)
					.single()
				);

				targetID = main?.ID ?? songID;

				songData = await sb.Query.getRecordset(rs => rs
					.select("Track.ID", "Available", "Link", "Name", "Duration")
					.select("Video_Type.Link_Prefix AS Prefix")
					.from("music", "Track")
					.join("data", "Video_Type")
					.join({
						toTable: "Track_Relationship",
						on: "Track_Relationship.Track_From = Track.ID"
					})
					.where("Video_Type = %n", 1)
					.where("Available = %b", true)
					.where("Relationship IN %s+", ["Archive of", "Reupload of"])
					.where("Track_To = %n", targetID)
					.limit(1)
					.single()
				);
			}

			if (songData) {
				url = songData.Prefix.replace(videoTypePrefix, songData.Link);
			}
			else {
				url = null;
			}
		}

		if (linkParser.autoRecognize(url)) {
			data = await linkParser.fetchData(url);

			if (!data) {
				return {
					success: false,
					reply: `The video link you posted is currently unavailable!`
				};
			}
		}
		else if (parsedURL.host) {
			if (parsedURL.host === "clips.twitch.tv") {
				// `find(Boolean)` is meant to take the first non-empty string in the resulting split-array
				const slug = parsedURL.path.split("/").find(Boolean);
				const response = await sb.Got("IVR", `v2/twitch/clip/${slug}`);
				if (!response.ok) {
					return {
						success: false,
						reply: "Invalid Twitch clip provided!"
					};
				}

				const { clip, clipKey = "" } = response.body;
				const [bestQuality] = clip.videoQualities.sort((a, b) => Number(b.quality) - Number(a.quality));

				data = {
					name: clip.title,
					ID: `https://clips.twitch.tv/${clip.slug}`,
					link: `${bestQuality.sourceURL}${clipKey}`,
					duration: clip.durationSeconds,
					videoType: { ID: 19 }
				};
			}
			else {
				const name = decodeURIComponent(parsedURL.path.split("/").pop());
				const encoded = encodeURI(decodeURI(url));
				data = {
					name,
					ID: encoded,
					link: encoded,
					duration: null,
					videoType: { ID: 19 }
				};
			}
		}

		// If no data have been extracted from a link, attempt a search query on Youtube/Vimeo
		if (!data) {
			let lookup = null;
			if (type === "vimeo") {
				const result = await fetchVimeoData(args.join(" "));
				if (!result.success) {
					return result;
				}
				else if (result.data.length > 0) {
					const link = result.data[0].uri.split("/").pop();
					lookup = { link };
				}
			}
			else if (type === "youtube") {
				const data = await searchYoutube(
					args.join(" "),
					sb.Config.get("API_GOOGLE_YOUTUBE")
				);

				lookup = (data[0])
					? { link: data[0].ID }
					: null;
			}
			else {
				return {
					success: false,
					reply: "Incorrect video search type provided!"
				};
			}

			if (!lookup) {
				return {
					reply: "No video matching that query has been found."
				};
			}
			else {
				data = await linkParser.fetchData(lookup.link, type);
			}
		}

		// Put together the total length of the video, for logging purposes
		const length = data.duration ?? data.length;
		if (startTime < 0) {
			startTime = length + startTime;
			if (startTime < 0) {
				return {
					success: false,
					reply: `Invalid start time!`
				};
			}
		}
		if (endTime < 0) {
			endTime = length + endTime;
			if (endTime < 0) {
				return {
					success: false,
					reply: `Invalid end time!`
				};
			}
		}

		if (startTime !== null && endTime !== null && startTime > endTime) {
			return {
				success: false,
				reply: "Start time cannot be greater than the end time!"
			};
		}

		const exists = queue.find(i => (
			i.Link === data.ID
			&& i.Start_Time === startTime
			&& i.End_Time === endTime
		));

		let existsString = "";
		if (exists) {
			const string = `This video is already queued as ID ${exists.VLC_ID}!`;
			if (!sb.Config.get("SONG_REQUESTS_DUPLICATE_ALLOWED", false)) {
				return {
					success: false,
					reply: string
				};
			}
			else {
				existsString = string;
			}
		}

		const authorString = (data.author) ? ` by ${data.author}` : "";
		const segmentLength = (endTime ?? length) - (startTime ?? 0);

		let bonusString = "";
		const bonusLimit = await context.user.getDataProperty("supinicStreamSongRequestExtension") ?? 0;
		if ((limits.totalTime + segmentLength) > limits.time) {
			const excess = sb.Utils.round((limits.totalTime + segmentLength) - limits.time, 1);
			if (excess > bonusLimit) {
				return {
					success: false,
					reply: sb.Utils.tag.trim `
						Your video would exceed the total video limit by ${excess} seconds!.
						You can change the start and end points of the video with these arguments, e.g.: start:0 end:${limits.totalTime - limits.time}
					`
				};
			}
			else {
				const remainingBonus = sb.Utils.round(bonusLimit - excess, 1);
				await context.user.setDataProperty("supinicStreamSongRequestExtension", remainingBonus);
				bonusString = `Used up ${excess} seconds from your extension, ${remainingBonus} remaining.`;
			}
		}

		// Actually attempt to request the video into VLC
		let id = null;
		try {
			let vlcLink = data.link;
			if (data.type === "bilibili") {
				const { promisify } = require("node:util");
				const shell = promisify(require("node:child_process").exec);
				const ytdlPath = sb.Config.get("YOUTUBEDL_PATH", false);
				if (!ytdlPath) {
					return {
						success: false,
						reply: "No youtube-dl path configured, cannot get-url for this video!"
					};
				}

				const result = await shell(`${ytdlPath} --get-url ${data.link}`);
				vlcLink = result.stdout;
			}

			// Extreme hard-coded exception! Apparently, some YouTube videos do not play properly in VLC if and only
			// if they are queued with HTTPS. This is a temporary solution and should be removed as soon as a proper
			// fix exists. Probably upgrading to VLC 4.x will work.
			// Reference: https://forum.videolan.org/viewtopic.php?t=111579
			if (data.type === "youtube") {
				vlcLink = vlcLink.replace("https://", "http://");
			}

			id = await sb.VideoLANConnector.add(vlcLink, { startTime, endTime });
		}
		catch (e) {
			console.warn("sr error", e);
			await sb.Config.set("SONG_REQUESTS_STATE", "off");
			return {
				reply: `The desktop listener is currently turned off. Turning song requests off.`
			};
		}

		const videoType = data.videoType ?? await sb.Query.getRecordset(rs => rs
			.select("ID")
			.from("data", "Video_Type")
			.where("Parser_Name = %s", data.type)
			.limit(1)
			.single()
		);

		// Log the request into database
		const row = await sb.Query.getRow("chat_data", "Song_Request");
		row.setValues({
			VLC_ID: id,
			Link: data.ID,
			Name: sb.Utils.wrapString(data.name, 100),
			Video_Type: videoType.ID,
			Length: (data.duration) ? Math.ceil(data.duration) : null,
			Status: (queue.length === 0) ? "Current" : "Queued",
			Started: (queue.length === 0) ? new sb.Date() : null,
			User_Alias: context.user.ID,
			Start_Time: startTime ?? null,
			End_Time: endTime ?? null
		});
		await row.save();

		let when = "right now";
		const status = await sb.VideoLANConnector.status();
		if (queue.length > 0) {
			const current = queue.find(i => i.Status === "Current");
			const { time: currentVideoPosition, length } = status;
			const endTime = current?.End_Time ?? length;

			const playingDate = new sb.Date().addSeconds(endTime - currentVideoPosition);
			const inQueue = queue.filter(i => i.Status === "Queued");

			for (const { Duration: length } of inQueue) {
				playingDate.addSeconds(length ?? 0);
			}

			if (playingDate <= sb.Date.now()) {
				when = "right now";
			}
			else {
				when = sb.Utils.timeDelta(playingDate);
			}
		}

		const seek = [];
		if (startTime !== null) {
			seek.push(`starting at ${sb.Utils.formatTime(startTime, true)}`);
		}
		if (endTime !== null) {
			seek.push(`ending at ${sb.Utils.formatTime(endTime, true)}`);
		}

		const pauseString = (sb.Config.get("SONG_REQUESTS_VLC_PAUSED"))
			? "Song requests are paused at the moment."
			: "";
		const seekString = (seek.length > 0)
			? `Your video is ${seek.join(" and ")}.`
			: "";

		return {
			reply: sb.Utils.tag.trim `
				Video "${data.name}"${authorString} successfully added to queue with ID ${id}!
				It is playing ${when}.
				${seekString}
				${pauseString}
				${existsString}
				(slots: ${limits.requests + 1}/${limits.amount}, length: ${Math.round(limits.totalTime + segmentLength)}/${limits.time})
				${bonusString}
			`
		};
	}),
	Dynamic_Description: (async (prefix) => [
		"Request a song (video) to play on Supinic's stream.",
		"Supports YouTube, Vimeo, Soundcloud links. Furthermore, all custom media (raw links) are supported as well.",
		"",

		`<code>${prefix}songrequest (link)</code>`,
		`<code>${prefix}sr (link)</code>`,
		"Request the video, adding it to the end of the queue.",
		"",

		`<code>${prefix}sr start:10 (link)</code>`,
		"Request the video, making it start any amount of seconds from the beginning. Here, it starts 10 seconds in.",
		"",

		`<code>${prefix}sr end:300 (link)</code>`,
		"Request the video, making it end any amount of seconds from the beginning. Here, it starts 5 minutes (300s) in.",
		"",

		`<code>${prefix}sr start:50 end:55 (link)</code>`,
		"<code>start</code> and <code>end</code> can be combined - here, the video will play from 50 to 55 seconds.",
		"",

		`<code>${prefix}sr start:-60 (link)</code>`,
		`<code>${prefix}sr end:-10 (link)</code>`,
		`<code>${prefix}sr start:-15 end:-10 (link)</code>`,
		"If either <code>start</code> or <code>end</code> are negative numbers, they signify the length from the end of the video.",
		"E.g.: if the video is 5 minutes long, <code>start:-10</code> will start the video 10 seconds from the end, at 04:50.",
		"Any combination of negative and positive numbers between the parameters is accepted. It just has to make sense - so that the end is not earlier than the start."
	])
};
