import { VIDEO_TYPE_REPLACE_PREFIX } from "../../utils/command-utils.js";
import cacheKeys from "../../utils/shared-cache-keys.json" with { type: "json" };
import { CommandDefinition, Context } from "../../classes/command.js";

const { SONG_REQUESTS_STATE, SONG_REQUESTS_VLC_PAUSED } = cacheKeys;

type SongCheckType = "current" | "previous" | "next";
const ALLOWED_SONG_CHECKS: Set<unknown> = new Set(["current", "previous", "next"]);
const isAllowedSongCheck = (input: unknown): input is SongCheckType => ALLOWED_SONG_CHECKS.has(input);

const introductionStrings = {
	current: "Previously played",
	previous: "Currently playing",
	next: "Playing next"
} as const;
const includePositionsType = {
	current: true,
	previous: false,
	next: false
} as const;

const params = [{ name: "linkOnly", type: "boolean" }] as const;

export default {
	Name: "current",
	Aliases: ["song"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Fetches the current song playing on stream.",
	Flags: ["developer", "mention", "pipe", "whitelist"],
	Params: params,
	Whitelist_Response: "This command is only available in @Supinic channel on Twitch!",
	Code: (async function current (context: Context<typeof params>, ...args) {
		if (!sb.VideoLANConnector) {
			return {
				success: false,
				reply: "VLC connector is not available! Check configuration if this is required."
			};
		}

		const state = await core.Cache.getByPrefix(SONG_REQUESTS_STATE) as string | undefined;
		if (!state || state === "off") {
			return {
				success: false,
				reply: "Song requests are currently turned off."
			};
		}
		else if (state === "vlc-read") {
			const item = sb.VideoLANConnector.currentPlaylistItem;
			if (!item) {
				return {
					success: false,
					reply: "Nothing is currently playing."
				};
			}

			let leaf = item;
			while (leaf.type !== "leaf" && leaf.children && leaf.children.length > 0) {
				leaf = leaf.children[0];
			}

			return {
				reply: `Currently playing: ${leaf.name}`
			};
		}

		let type: SongCheckType;
		if (context.invocation === "current") {
			type = "current";
		}
		else {
			const firstArg = args.at(0);
			type = (isAllowedSongCheck(firstArg)) ? firstArg : "current";
		}

		type PlayingResult = {
			Name: string;
			VLC_ID: number;
			Link: string;
			User: number;
			Prefix: string;
			VTID: number;
			Start_Time: number | null;
			End_Time: number | null;
		};

		const playing = await core.Query.getRecordset<PlayingResult | undefined>(rs => {
			rs.select("Name", "VLC_ID", "Link", "User_Alias AS User", "Start_Time", "End_Time")
				.select("Video_Type.ID AS VTID", "Video_Type.Link_Prefix AS Prefix")
				.from("chat_data", "Song_Request")
				.join({
					toDatabase: "data",
					toTable: "Video_Type",
					on: "Video_Type.ID = Song_Request.Video_type"
				})
				.limit(1)
				.single();

			if (type === "previous") {
				rs.where("Status = %s", "Inactive");
				rs.orderBy("Song_Request.ID DESC");
			}
			else if (type === "current") {
				rs.where("Status = %s", "Current");
			}
			else {
				rs.where("Status = %s", "Queued");
				rs.orderBy("Song_Request.ID ASC");
			}

			return rs;
		});

		if (playing) {
			const link = playing.Prefix.replace(VIDEO_TYPE_REPLACE_PREFIX, playing.Link);
			if (context.params.linkOnly) {
				return {
					success: true,
					reply: link
				};
			}

			const userData = await sb.User.get(playing.User);
			const { length, time } = await sb.VideoLANConnector.getUpdatedStatus();

			let currentPosition = time;
			let segmentLength = length;
			if (playing.Start_Time || playing.End_Time) {
				currentPosition = time - (playing.Start_Time ?? 0);
				segmentLength = (playing.End_Time ?? length) - (playing.Start_Time ?? 0);
			}

			let position = "";
			const includePosition = includePositionsType[type];
			if (includePosition) {
				if (currentPosition === -1) {
					position = "The song is currently being queued, but hasn't started playing yet.";
				}
				else {
					position = `Current position: ${currentPosition}/${segmentLength}s.`;
				}
			}

			const pauseStatus = await core.Cache.getByPrefix(SONG_REQUESTS_VLC_PAUSED);
			const pauseString = (pauseStatus === true)
				? "The song request is paused at the moment."
				: "";

			const requesterUsername = userData?.Name ?? "(N/A)";
			const introductionString = introductionStrings[type];
			if (playing.VTID === 15) {
				return {
					reply: core.Utils.tag.trim `
						${introductionString}
						${playing.Name}
						(ID ${playing.VLC_ID}) - requested by ${requesterUsername}.
						${position}
						${pauseString}
					`
				};
			}

			return {
				reply: core.Utils.tag.trim `
					${introductionString}:
					${playing.Name}
					(ID ${playing.VLC_ID}) - requested by ${requesterUsername}.
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
	Dynamic_Description: (prefix) => [
		`Checks the currently playing song on Supinic's channel/stream`,
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
	]
} satisfies CommandDefinition;
