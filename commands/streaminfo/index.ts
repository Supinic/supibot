import * as z from "zod";
import { declare } from "../../classes/command.js";
import { SupiDate } from "supi-core";
import { ivrUserDataSchema } from "../../utils/schemas.js";

const streamSchema = z.object({
	data: z.array(z.object({
		game_id: z.string(),
		game_name: z.string(),
		id: z.string(),
		is_mature: z.boolean(),
		language: z.string(),
		started_at: z.string(),
		title: z.string().nullable(), // empty string only on error
		type: z.enum(["live", ""]),
		viewer_count: z.int().min(0)
	}))
});

const vodSchema = z.object({
	data: z.array(z.object({
		created_at: z.string(), // RFC 3339
		duration: z.string(), // ISO 8601
		title: z.string(),
		url: z.string()
	}))
});

type StreamData = z.infer<typeof streamSchema>["data"][number];
type VodData = z.infer<typeof vodSchema>["data"][number];

export default declare({
	Name: "streaminfo",
	Aliases: ["si", "uptime", "vod"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts information about a Twitch channel's stream, or the current channel if none is provided.",
	Flags: ["external-input","mention","non-nullable","pipe"],
	Params: [{ name: "rawData", type: "boolean" }] as const,
	Whitelist_Response: null,
	Code: (async function streamInfo (context, ...args) {
		let targetChannel;
		if (args.length === 0) {
			if (context.platform.Name !== "twitch") {
				return {
					success: false,
					reply: `No Twitch channel provided!`
				};
			}
			else if (!context.channel) {
				return {
					success: false,
					reply: `No channel provided!`
				};
			}

			targetChannel = context.channel.Name;
		}
		else {
			targetChannel = sb.Channel.normalizeName(args[0]);
		}

		const platform = sb.Platform.getAsserted("twitch");
		const targetData = await sb.User.get(targetChannel);
		const channelID = targetData?.Twitch_ID ?? await platform.getUserID(targetChannel);
		if (!channelID) {
			return {
				success: false,
				reply: "There is no Twitch channel with that name!"
			};
		}

		const streamResponse = await core.Got.get("Helix")({
			url: "streams",
			searchParams: {
				user_id: channelID
			}
		});

		if (streamResponse.statusCode !== 200) {
			return {
				success: false,
				reply: `Cannot check for stream info! Try again later.`
			};
		}

		let vodString = "";
		let vodEnd;
		const stream = streamSchema.parse(streamResponse.body).data.at(0);

		const vodResponse = await core.Got.get("Helix")({
			url: "videos",
			searchParams: {
				user_id: channelID
			}
		});

		let vodTitle: string | undefined;
		const vod = vodSchema.parse(vodResponse.body);
		const rawData: { vod: VodData | null; stream: StreamData | undefined } = { vod: null, stream };

		if (vod.data.length !== 0) {
			const data = vod.data[0];
			rawData.vod = data;

			const vodDurationSeconds = core.Utils.parseDuration(data.duration, { target: "sec" });
			vodTitle = data.title;
			vodEnd = new SupiDate(data.created_at).addSeconds(vodDurationSeconds);

			if (stream) {
				const offset = 90; // Implicitly offset the VOD by several seconds, to account for inaccuracies
				const stamp = vodDurationSeconds - offset;
				const clampedTimestamp = Math.max(stamp, 0);

				vodString = `${data.url}?t=${clampedTimestamp}s`;
			}
			else {
				vodString = data.url;
			}
		}

		if (context.params.rawData) {
			return {
				reply: "Data is available.",
				data: rawData
			};
		}

		if (!stream) {
			const broadcasterResponse = await core.Got.get("IVR")({
				url: "v2/twitch/user",
				searchParams: {
					id: channelID
				}
			});

			if (broadcasterResponse.statusCode !== 200 || broadcasterResponse.body.length === 0) {
				return {
					reply: `Channel is offline - no more data currently available. Try again later`
				};
			}

			const broadcasterData = ivrUserDataSchema.parse(broadcasterResponse.body)[0];
			const { banned, lastBroadcast } = broadcasterData;

			let status;
			if (banned) {
				const { banReason } = broadcasterData;
				status = (banReason === "DEACTIVATED")
					? `unavailable (${banReason})`
					: `banned (${banReason})`;
			}
			else {
				status = "offline";
			}

			if (!lastBroadcast?.startedAt) {
				if (banned) {
					return {
						reply: `Channel is ${status} - never streamed before.`
					};
				}
				else {
					return {
						reply: core.Utils.tag.trim `
							Channel is ${status} - never streamed before.
							However, lately Twitch doesn't always show the proper date of last stream.
							Check the official link, maybe it will work there: 
							https://www.twitch.tv/${targetChannel}/schedule
						`
					};
				}
			}

			const start = new SupiDate(lastBroadcast.startedAt);
			if (vodString && vodEnd) {
				// If the difference between the VOD being created and end of stream is > 1 hour, assume this is
				// not the correct VOD link and potentially random highlight video, or something else.
				// In that case, delete the value of `vodString` so the URL does not appear.
				const difference = Math.abs(start.valueOf() - vodEnd.valueOf());
				if (difference > 3_600_000) {
					vodString = "";
				}
			}

			const title = vodTitle ?? lastBroadcast.title ?? "(no title)";
			const delta = core.Utils.timeDelta(start);
			return {
				reply: `Channel is ${status} - last streamed ${delta} - title: ${title} ${vodString}`
			};
		}
		else {
			const started = core.Utils.timeDelta(new SupiDate(stream.started_at));
			const viewersSuffix = (stream.viewer_count === 1) ? "" : "s";
			const broadcast = (stream.game_name)
				? `playing ${stream.game_name}`
				: `streaming under no category`;

			return {
				reply: core.Utils.tag.trim `
					${targetChannel} is ${broadcast}, 
					since ${started} 
					for ${core.Utils.groupDigits(stream.viewer_count)} viewer${viewersSuffix}.
					Title: ${stream.title ?? "(no title)"} 
					https://twitch.tv/${targetChannel.toLowerCase()}
					${vodString}
				`
			};
		}
	}),
	Dynamic_Description: ((prefix) => [
		"Fetches the live status of a provided Twitch channel.",
		"Uses the channel you're currently in if you don't provide one.",
		"This also means you <i>must</i> provide a channel if you're in Twitch whispers or outside of Twitch.",
		"",

		`<code>${prefix}streaminfo (channel)</code>`,
		`<code>${prefix}streaminfo forsen</code>`,
		`Posts info about a Twitch channel's stream.`,
		`If it is live - posts info about the stream, and details.`,
		`If not currently live - posts info about the previous stream.`
	])
});
