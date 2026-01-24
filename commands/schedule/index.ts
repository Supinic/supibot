import { SupiDate } from "supi-core";
import { declare } from "../../classes/command.js";
import type { TwitchPlatform } from "../../platforms/twitch.js";
import { twitchScheduleSchema, twitchStreamSchema } from "../../utils/schemas.js";

export default declare({
	Name: "schedule",
	Aliases: null,
	Cooldown: 30000,
	Description: "Posts the channel's stream schedule.",
	Flags: ["external-input", "mention", "non-nullable", "opt-out", "pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function schedule (context, channel) {
		let channelName;
		if (channel) {
			channelName = channel;
		}
		else if (context.platform.name === "twitch" && context.channel) {
			channelName = context.channel.Name;
		}

		if (!channelName) {
			return {
				success: false,
				reply: `No channel provided, and there is no default channel to be used!`
			};
		}

		// @todo remove typecast when platform is discriminated by name
		const platform = context.platform as TwitchPlatform;
		const channelID = await platform.getUserID(channelName);
		if (!channelID) {
			return {
				success: false,
				reply: `Provided user does not exist on Twitch, or is currently banned!`
			};
		}

		const response = await core.Got.get("Helix")({
			url: "schedule",
			searchParams: {
				broadcaster_id: channelID
			}
		});

		if (response.statusCode === 404) {
			return {
				success: false,
				reply: `Provided user does not have any schedule set up!`
			};
		}
		else if (!response.ok) {
			return {
				success: false,
				reply: `Could not check for stream schedule!`
			};
		}

		const { segments: rawSegments, vacation } = twitchScheduleSchema.parse(response.body).data;
		if (!rawSegments) {
			return {
				success: false,
				reply: `Provided user does not have a schedule set up anymore!`
			};
		}

		const segments = rawSegments.filter(i => !i.canceled_until);
		if (!Array.isArray(segments) || segments.length === 0) {
			return {
				success: false,
				reply: `No stream schedule segments have been found!`
			};
		}

		const now = new SupiDate();
		const scheduleUrl = `https://twitch.tv/${channelName}/schedule`;
		if (vacation !== null) {
			const start = new SupiDate(vacation.start_time);
			const end = new SupiDate(vacation.end_time);

			const [firstSeg] = segments;
			const firstSegStart = new SupiDate(firstSeg.start_time);
			const firstSegEnd = new SupiDate(firstSeg.end_time);

			// Only mention the vacation if it affects the first segment in the list, and only if it hasn't ended yet.
			if (firstSegStart > start && firstSegEnd < end && end > now) {
				const verb = (start < now) ? "started" : "starts";
				return {
					reply: core.Utils.tag.trim `
						Streaming schedule is interrupted.
						Vacation ${verb} on ${start.format("Y-m-d")}
						and ends on ${end.format("Y-m-d")} (${core.Utils.timeDelta(end)}).
						${scheduleUrl}
					`
				};
			}
		}

		let segment;
		let lateString = "";
		if (segments.length === 1) {
			segment = segments[0];
		}
		else {
			const firstSegmentStart = new SupiDate(segments[0].start_time);
			if (firstSegmentStart < now) { // First stream segment should already be underway
				const response = await core.Got.get("Helix")({
					url: "streams",
					searchParams: {
						user_id: channelID
					}
				});

				const { data } = twitchStreamSchema.parse(response.body);
				const isLive = Boolean(response.statusCode === 200 && data.length !== 0);

				if (!isLive) { // Stream is not live - use the first segment (when it should have started), and mention that stream is late
					segment = segments[0];

					const preparationTime = new SupiDate(segment.start_time).addMinutes(5);
					const now = new SupiDate();
					if (now < preparationTime) {
						const emote = await context.getBestAvailableEmote(["pajaPause", "PauseMan", "PauseManSit", "PauseChamp"], "😐");
						lateString = `The stream is about to start ${emote}`;
					}
					else {
						const emote = await context.getBestAvailableEmote(["Weirdga", "WeirdChamp", "supiniWeirdga", "FeelsWeirdMan"], "🤨");
						lateString = `The stream seems to be late ${emote}`;
					}
				}
				else { // Stream is live - all good, show the schedule for the next segment
					segment = segments[1];
				}
			}
			else { // No segment is underway, use the first one in the list
				segment = segments[0];
			}
		}

		const game = segment.category?.name ?? "(no category)";
		const title = (segment.title !== "") ? segment.title : "(no title)";
		const target = (channelName.toLowerCase() === context.user.Name) ? "Your" : `${channelName}'s`;
		const time = core.Utils.timeDelta(new SupiDate(segment.start_time));

		return {
			reply: core.Utils.tag.trim `
				${target} next stream:
				${game} - ${title},
				starting ${time}.
				${lateString} 
				${scheduleUrl}
			`
		};
	}),
	Dynamic_Description: null
});
