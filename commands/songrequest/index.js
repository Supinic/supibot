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
		{ name: "type", type: "string" },
	],
	Whitelist_Response: "Only available in supinic's channel.",
	Static_Data: (() => {
		const limits = {
			time: 900,
			amount: 10
		};
	
		return {
			limits,
			blacklist: {
				sites: [
					"grabify.link",
					"leancoding.co",
					"stopify.co",
					"freegiftcards.co",
					"joinmy.site",
					"curiouscat.club",
					"catsnthings.fun",
					"catsnthing.com",
					"iplogger.org",
					"2no.co",
					"iplogger.com",
					"iplogger.ru",
					"yip.su",
					"iplogger.co",
					"iplogger.info",
					"ipgrabber.ru",
					"ipgraber.ru",
					"iplis.ru",
					"02ip.ru",
					"ezstat.ru"
				],
				tracks: [
					"LVCIU5x_zIk"
				],
				authors: [
					"UCeM9xfry6R09FxPZgRV1XcA"
				]
			},
	
			cytubeIntegration: {
				limits: {
					total: 5,
					time: 600
				},
	
				queue: async function (link) {
					const properLink = sb.Utils.linkParser.autoRecognize(link);
					if (!properLink) {
						const [bestResult] = await sb.Utils.searchYoutube(
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
	
					const linkData = await sb.Utils.linkParser.fetchData(link);
					if (!linkData) {
						return {
							success: false,
							reply: "Link not found!"
						};
					}
					else if (linkData.duration > this.limits.time) {
						return {
							success: false,
							reply: `Video too long! ${linkData.duration}sec / ${this.limits.time}sec`
						};
					}
	
					const { Self_Name: botName, controller } = sb.Platform.get("cytube");
					const playlist = [
						controller.currentlyPlaying,
						...controller.playlistData
					].filter(i => i && i.queueby?.toLowerCase() === botName.toLowerCase());
	
					if (playlist.length > this.limits.total) {
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
	
					controller.queue(cytubeType, linkData.ID);
					return {
						reply: `Video ${linkData.link} "${linkData.name}" added to Cytube successfully.`
					};
				}
			},
	
			checkLimits: (userData, playlist) => {
				const userRequests = playlist.filter(i => i.User_Alias === userData.ID);
				if (userRequests.length >= limits.amount) {
					return {
						canRequest: false,
						reason: `Maximum amount of videos queued! (${userRequests.length}/${limits.amount})`
					};
				}
	
				let totalTime = 0;
				for (const request of userRequests) {
					totalTime += (request.End_Time ?? request.Length) - (request.Start_Time ?? 0);
				}
	
				totalTime = Math.ceil(totalTime);
				if (totalTime >= limits.time) {
					return {
						canRequest: false,
						reason: `Maximum video time exceeded! (${totalTime}/${limits.time} seconds)`
					};
				}
	
				return {
					canRequest: true,
					totalTime: totalTime,
					requests: userRequests.length,
					reason: null,
					time: limits.time,
					amount: limits.amount
				};
			},
	
			parseTimestamp: (string) => {
				const type = sb.Utils.linkParser.autoRecognize(string);
				if (type === "youtube" && string.includes("t=")) {
					const { parse } = require("url");
					let { query } = parse(string);
	
					if (/t=\d+/.test(query)) {
						query = query.replace(/(t=\d+\b)/, "$1sec");
					}
	
					return sb.Utils.parseDuration(query, { target: "sec" });
				}
			}
		};
	}),
	Code: (async function songRequest (context, ...args) {
		if (args.length === 0) {
	            // If we got no args, just redirect to $current 4HEad
			return await sb.Command.get("current").execute(context);
		}
	
		const state = sb.Config.get("SONG_REQUESTS_STATE");
		if (state === "off") {
			return { reply: "Song requests are currently turned off." };
		}
		else if (state === "vlc-read") {
			return { reply: `Song requests are currently read-only. You can check what's playing with the "current" command, but not queue anything.` };
		}
		else if (state === "dubtrack") {
			const dubtrack = (await sb.Command.get("dubtrack").execute(context)).reply;
			return { reply: "Song requests are currently using dubtrack. Join here: " + dubtrack + " :)" };
		}
		else if (state === "cytube") {
			if (!sb.Config.get("EXTERNAL_CYTUBE_SR_ENABLED", false)) {
				const cytube = (await sb.Command.get("cytube").execute(context)).reply;
				return {
					reply: "Song requests are currently using Cytube. Join here: " + cytube + " :)"
				};
			}
	
			return await this.staticData.cytubeIntegration.queue(args.join(" "));
		}
	
		const queue = await sb.VideoLANConnector.getNormalizedPlaylist();
		const limits = this.staticData.checkLimits(context.user, queue);
		if (!limits.canRequest) {
			return {
				reply: limits.reason
			};
		}

		let startTime = context.params.start ? Number(context.params.start) : null;
		if (startTime && (!Number.isFinite(startTime) || startTime > Math.pow(2, 32))) {
			return {
				success: false,
				reply: "Invalid start time!"
			};
		}

		let endTime = context.params.end ? Number(context.params.end) : null;
		if (endTime && (!Number.isFinite(endTime) || endTime > Math.pow(2, 32))) {
			return {
				success: false,
				reply: "Invalid start time!"
			};
		}

		let url = args.join(" ");
		const type = context.params.type ?? "youtube";
		const potentialTimestamp = this.staticData.parseTimestamp(url);
		if (potentialTimestamp && startTime === null) {
			startTime = potentialTimestamp;
		}
	
		if (startTime !== null && endTime !== null && startTime > endTime) {
			return {
				success: false,
				reply: "Start time cannot be greater than the end time!"
			};
		}
	
		const parsedURL = require("url").parse(url);
		let data = null;
	
		const { blacklist } = this.staticData;
		if (blacklist.sites.includes(parsedURL.host)) {
			return {
				success: false,
				reply: "Don't."
			};
		}
		else if (parsedURL.host === "supinic.com" && parsedURL.path.includes("/track/detail")) {
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
	
		if (sb.Utils.linkParser.autoRecognize(url)) {
			data = await sb.Utils.linkParser.fetchData(url);
		}
		else if (parsedURL.host) {
			const meta = await sb.Utils.getMediaFileData(url);
			if (meta?.duration) {
				const name = decodeURIComponent(parsedURL.path.split("/").pop());
				const encoded = encodeURI(decodeURI(url));
				data = {
					name,
					ID: encoded,
					link: encoded,
					duration: meta.duration,
					videoType: { ID: 19 }
				};
			}
		}
	
		// If no data have been extracted from a link, attempt a search query on Youtube/Vimeo
		if (!data) {
			let lookup = null;
			if (type === "vimeo") {
				const { body, statusCode } = await sb.Got("Vimeo", {
					url: "videos",
					throwHttpErrors: false,
					searchParams: new sb.URLParams()
						.set("query", args.join(" "))
						.set("per_page", "1")
						.set("sort", "relevant")
						.set("direction", "desc")
						.toString()
				});
	
				if (statusCode !== 200 || body.error) {
					return {
						success: false,
						reply: `Vimeo API returned error ${statusCode}: ${body.error}`
					};
				}
				else if (body.data.length > 0) {
					const link = body.data[0].uri.split("/").pop();
					lookup = { link };
				}
			}
			else if (type === "youtube") {
				const data = await sb.Utils.searchYoutube(
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
				}
			}
	
			if (!lookup) {
				return {
					reply: "No video matching that query has been found."
				};
			}
			else {
				data = await sb.Utils.linkParser.fetchData(lookup.link, type);
			}
		}
	
		if (blacklist.tracks.includes(data.ID) || blacklist.authors.includes(data.authorID)) {
			return {
				success: false,
				reply: `Track/author has been blacklisted!`
			};
		}

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
		if ((limits.totalTime + segmentLength) > limits.time) {
			const excess = (limits.totalTime + segmentLength) - limits.time;
			return {
				reply: sb.Utils.tag.trim `
					Your video would exceed the total video limit by ${excess} seconds!.
					You can change the start and end points of the video with these arguments, e.g.: start:0 end:${limits.totalTime - limits.time}
				`
			};
		}
	
		let id = null;
		try {
			let vlcLink = data.link;
			if (data.type === "bilibili" || data.type === "nicovideo") {
				const { promisify } = require("util");
				const shell = promisify(require("child_process").exec);
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
	
			id = await sb.VideoLANConnector.add(vlcLink, { startTime, endTime });
		}
		catch (e) {
			console.warn("sr error", e);
			await sb.Config.set("SONG_REQUESTS_STATE", "off");
			return {
				reply: `The desktop listener is currently turned off. Turning song requests off.`
			};
		}
	
		let when = "right now!";
		let videoStatus = "Current";
		let started = new sb.Date();
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
	
			started = null;
			videoStatus = "Queued";
			
			if (playingDate <= sb.Date.now()) {
				when = "right now!";
			}
			else {
				when = sb.Utils.timeDelta(playingDate);
			}
		}
	
		const videoType = data.videoType ?? await sb.Query.getRecordset(rs => rs
			.select("ID")
			.from("data", "Video_Type")
			.where("Parser_Name = %s", data.type)
			.limit(1)
			.single()
		);
	
		const row = await sb.Query.getRow("chat_data", "Song_Request");
		row.setValues({
			VLC_ID: id,
			Link: data.ID,
			Name: sb.Utils.wrapString(data.name, 100),
			Video_Type: videoType.ID,
			Length: (data.duration) ? Math.ceil(data.duration) : null,
			Status: videoStatus,
			Started: started,
			User_Alias: context.user.ID,
			Start_Time: startTime ?? null,
			End_Time: endTime ?? null
		});
		await row.save();
	
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
			`
		};
	}),
	Dynamic_Description: null
};