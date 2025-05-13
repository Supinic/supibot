import getLinkParser from "../../utils/link-parser.js";
import type { default as LinkParser } from "track-link-parser";

import { searchYoutube, VIDEO_TYPE_REPLACE_PREFIX } from "../../utils/command-utils.js";

import cacheKeys from "../../utils/shared-cache-keys.json" with { type: "json" };
import { type User } from "../../classes/user.js";
import { type DatabaseVideo } from "../../singletons/vlc-client.js";
import { Context, type CommandDefinition } from "../../classes/command.js";
import { SupiDate, SupiError } from "supi-core";
import type { IvrClipData } from "../../@types/globals.js";
const { SONG_REQUESTS_STATE, SONG_REQUESTS_VLC_PAUSED } = cacheKeys;

const REQUEST_TIME_LIMIT = 900;
const REQUEST_AMOUNT_LIMIT = 10;

const checkLimits = (userData: User, playlist: DatabaseVideo[]) => {
	const userRequests = playlist.filter(i => i.User_Alias === userData.ID);
	if (userRequests.length >= REQUEST_AMOUNT_LIMIT) {
		return {
			canRequest: false,
			reason: `Maximum amount of videos queued! (${userRequests.length}/${REQUEST_AMOUNT_LIMIT})`
		} as const;
	}

	let totalTime = 0;
	for (const request of userRequests) {
		totalTime += (request.End_Time ?? request.Length ?? 0) - (request.Start_Time ?? 0);
	}

	totalTime = Math.ceil(totalTime);

	return {
		canRequest: true,
		totalTime,
		requests: userRequests.length,
		reason: null,
		time: REQUEST_TIME_LIMIT,
		amount: REQUEST_AMOUNT_LIMIT
	} as const;
};

const ARBITRARY_MAX_YOUTUBE_TIMESTAMP = 2e12;
const parseTimestamp = (linkParser: LinkParser, string: string) => {
	const type = linkParser.autoRecognize(string);
	if (type !== "youtube") {
		return;
	}

	const url = new URL(string, "https://youtube.com");
	const timestamp = url.searchParams.get("t");
	if (!timestamp) {
		return;
	}

	const value = Number(timestamp.replace(/s$/, ""));
	if (!Number.isFinite(value) || value < 0 || value > ARBITRARY_MAX_YOUTUBE_TIMESTAMP) {
		return;
	}

	return value;
};

const params = [
	{ name: "start", type: "string" },
	{ name: "end", type: "string" },
	{ name: "type", type: "string" }
] as const;

export default {
	Name: "songrequest",
	Aliases: ["sr"],
	Cooldown: 5000,
	Description: "Requests a song to play on Supinic's stream. You can use \"start:\" and \"end:\" to request parts of a song using seconds or a time syntax. \"start:100\" or \"end:05:30\", for example.",
	Flags: ["mention","pipe","whitelist"],
	Params: params,
	Whitelist_Response: "Only available in supinic's channel.",
	Code: (async function songRequest (context: Context<typeof params>, ...args) {
		if (!sb.VideoLANConnector) {
			return {
				success: false,
				reply: "VLC connector is not available! Check configuration if this is required."
			};
		}

		if (args.length === 0) {
			// @todo merge $current into $songrequest as an alias and have it work here
			const currentCommand = sb.Command.get("current");
			if (!currentCommand) {
				throw new SupiError({
				    message: "No link to $current available"
				});
			}

			// If we got no args, just redirect to $current 4HEad
			return currentCommand.execute(context);
		}

		// Figure out whether song request are available, and where specifically
		const state = await core.Cache.getByPrefix(SONG_REQUESTS_STATE) as string | null;
		if (!state || state === "off") {
			return {
				reply: "Song requests are currently turned off."
			};
		}
		else if (state === "vlc-read") {
			return {
				reply: `Song requests are currently read-only. You can check what's playing with the "current" command, but not queue anything.`
			};
		}
		else if (state === "vlc") {
			// Simply make sure the VLC client is running if a song is being requested into it
			sb.VideoLANConnector.startClient();
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
		let startTime = (context.params.start) ? core.Utils.parseVideoDuration(context.params.start) : null;
		if (startTime !== null && (!Number.isFinite(startTime) || startTime > 2 ** 32)) {
			return {
				success: false,
				reply: "Invalid start time provided!"
			};
		}

		let endTime = (context.params.end) ? core.Utils.parseVideoDuration(context.params.end) : null;
		if (endTime !== null && (!Number.isFinite(endTime) || endTime > 2 ** 32)) {
			return {
				success: false,
				reply: "Invalid end time provided!"
			};
		}

		// Determine the video URL, based on the type of link provided
		let url: string | null = args.join(" ");
		const linkParser = await getLinkParser();
		const type = context.params.type ?? "youtube";
		const potentialTimestamp = parseTimestamp(linkParser, url);

		if (potentialTimestamp && startTime === null) {
			startTime = potentialTimestamp;
		}

		let parsedURL: URL | null;
		try {
			parsedURL = new URL(url);
		}
		catch {
			parsedURL = null;
		}

		let data = null;
		if (parsedURL && parsedURL.host === "supinic.com" && parsedURL.pathname.includes("/track/detail")) {
			const matchSongId = parsedURL.pathname.match(/(\d+)/);
			if (!matchSongId) {
				return {
				    success: false,
				    reply: "Invalid supinic.com track link provided!"
				};
			}

			const songID = Number(matchSongId[1]);
			if (!songID) {
				return {
					success: false,
					reply: "Invalid link!"
				};
			}

			type SongData = { ID: number; Available: boolean; Link: string; Name: string; Duration: number; Prefix: string; };
			let songData = await core.Query.getRecordset<SongData | undefined>(rs => rs
				.select("Track.ID", "Available", "Link", "Name", "Duration")
				.select("Video_Type.Link_Prefix AS Prefix")
				.from("music", "Track")
				.join("data", "Video_Type")
				.where("Track.ID = %n", songID)
				.where("Available = %b", true)
				.single()
			);

			if (!songData) {
				let targetID: number | null = null;
				const main = await core.Query.getRecordset<SongData | undefined>(rs => rs
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

				songData = await core.Query.getRecordset<SongData | undefined>(rs => rs
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
				url = songData.Prefix.replace(VIDEO_TYPE_REPLACE_PREFIX, songData.Link);
			}
			else {
				url = null;
			}
		}

		let videoType: number | null = null;
		if (url && linkParser.autoRecognize(url)) {
			data = await linkParser.fetchData(url);

			if (!data) {
				return {
					success: false,
					reply: `The video link you posted is currently unavailable!`
				};
			}
			else if (data.type === "nicovideo") {
				return {
					success: false,
					reply: "Nicovideo links are currently not supported!"
				};
			}
		}
		else if (url && parsedURL && parsedURL.host) {
			if (parsedURL.host === "clips.twitch.tv") {
				// `find(Boolean)` is meant to take the first non-empty string in the resulting split-array
				const slug = parsedURL.pathname.split("/").find(Boolean);
				if (!slug) {
					return {
					    success: false,
					    reply: "Invalid Twitch clip link provided!"
					};
				}

				const response = await core.Got.get("IVR")<IvrClipData>({
					url: `v2/twitch/clip/${slug}`
				});

				if (!response.ok) {
					return {
						success: false,
						reply: "Invalid Twitch clip provided!"
					};
				}

				const { clip, clipKey = "" } = response.body;
				const [bestQuality] = clip.videoQualities.sort((a, b) => Number(b.quality) - Number(a.quality));

				videoType = 19;
				data = {
					name: clip.title,
					ID: `https://clips.twitch.tv/${clip.slug}`,
					link: `${bestQuality.sourceURL}${clipKey}`,
					duration: clip.durationSeconds
				};
			}
			else {
				const lastPathSegment = parsedURL.pathname.split("/").at(-1);
				if (!lastPathSegment) {
					return {
					    success: false,
					    reply: "Could not parse provided URL!"
					};
				}

				const name = decodeURIComponent(lastPathSegment);
				const encoded = encodeURI(decodeURI(url));

				videoType = 19;
				data = {
					name,
					ID: encoded,
					link: encoded,
					duration: null
				};
			}
		}

		// If no data have been extracted from a link, attempt a search query on Youtube/Vimeo
		if (!data) {
			let lookup = null;
			if (type === "youtube") {
				const data = await searchYoutube(args.join(" "), {
					filterShortsHeuristic: true
				});

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
				const youtubeData = await linkParser.fetchData(lookup.link, type);
				if (!youtubeData) {
					throw new SupiError({
					    message: "Assert error: Searched Youtube video ID is not fetchable"
					});
				}

				data = youtubeData;
			}
		}

		// Put together the total length of the video, for logging purposes
		const length = data.duration;
		if (length === null && (startTime !== null || endTime !== null)) {
			return {
				success: false,
				reply: "Can't specify a start or end time for a video that doesn't have a set duration!"
			};
		}

		if (length !== null && startTime !== null && startTime < 0) {
			startTime = length + startTime;
			if (startTime < 0) {
				return {
					success: false,
					reply: `Invalid start time!`
				};
			}
		}
		if (length !== null && endTime !== null && endTime < 0) {
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

		const existsString = "";
		if (exists) {
			return {
				success: false,
				reply: `This video is already queued as ID ${exists.VLC_ID}!`
			};
		}

		const authorString = (data.author) ? ` by ${data.author}` : "";
		const segmentLength = (endTime ?? length ?? 0) - (startTime ?? 0);

		let bonusString = "";
		const bonusLimit = await context.user.getDataProperty("supinicStreamSongRequestExtension") ?? 0;
		if ((limits.totalTime + segmentLength) > limits.time) {
			const excess = core.Utils.round((limits.totalTime + segmentLength) - limits.time, 1);
			if (excess > bonusLimit) {
				return {
					success: false,
					reply: core.Utils.tag.trim `
						Your video would exceed the total video limit by ${excess} seconds!.
						You can change the start and end points of the video with these arguments, e.g.: start:0 end:${limits.totalTime - limits.time}
					`
				};
			}
			else {
				const remainingBonus = core.Utils.round(bonusLimit - excess, 1);
				await context.user.setDataProperty("supinicStreamSongRequestExtension", remainingBonus);
				bonusString = `Used up ${excess} seconds from your extension, ${remainingBonus} remaining.`;
			}
		}

		// Actually attempt to request the video into VLC
		let id = null;
		try {
			let vlcLink = data.link;

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
			await core.Cache.setByPrefix(SONG_REQUESTS_STATE, "off");
			return {
				reply: `The desktop listener is currently turned off! Turning song requests off.`
			};
		}

		const videoTypeName = data.type;
		if (!videoType && videoTypeName) {
			const dbVideoType = await core.Query.getRecordset<number | undefined>(rs => rs
				.select("ID")
				.from("data", "Video_Type")
				.where("Parser_Name = %s", videoTypeName)
				.limit(1)
				.flat("ID")
				.single()
			);

			if (!dbVideoType) {
				throw new SupiError({
				    message: "Assert error: Unknown video type coming from track-link-parser",
					args: { videoTypeName }
				});
			}

			videoType = dbVideoType;
		}

		// Log the request into database
		const row = await core.Query.getRow("chat_data", "Song_Request");
		row.setValues({
			VLC_ID: id,
			Link: data.ID,
			Name: core.Utils.wrapString(data.name, 100),
			Video_Type: videoType,
			Length: (data.duration) ? Math.ceil(data.duration) : null,
			Status: (queue.length === 0) ? "Current" : "Queued",
			Started: (queue.length === 0) ? new SupiDate() : null,
			User_Alias: context.user.ID,
			Start_Time: startTime ?? null,
			End_Time: endTime ?? null
		});
		await row.save();

		let when = "right now";
		const status = await sb.VideoLANConnector.getUpdatedStatus();
		if (queue.length > 0) {
			const current = queue.find(i => i.Status === "Current");
			const { time: currentVideoPosition, length } = status;
			const endTime = current?.End_Time ?? length;

			const playingDate = new SupiDate().addSeconds(endTime - currentVideoPosition);
			const inQueue = queue.filter(i => i.Status === "Queued");

			for (const item of inQueue) {
				playingDate.addSeconds(item.Duration ?? 0);
			}

			if (playingDate.valueOf() <= SupiDate.now()) {
				when = "right now";
			}
			else {
				when = core.Utils.timeDelta(playingDate);
			}
		}

		const seek = [];
		if (startTime !== null) {
			seek.push(`starting at ${core.Utils.formatTime(startTime, true)}`);
		}
		if (endTime !== null) {
			seek.push(`ending at ${core.Utils.formatTime(endTime, true)}`);
		}

		const pauseState = await core.Cache.getByPrefix(SONG_REQUESTS_VLC_PAUSED);
		const pauseString = (pauseState === true)
			? "Song requests are paused at the moment."
			: "";
		const seekString = (seek.length > 0)
			? `Your video is ${seek.join(" and ")}.`
			: "";

		return {
			reply: core.Utils.tag.trim `
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
	Dynamic_Description: (prefix) => [
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
	]
} satisfies CommandDefinition;
