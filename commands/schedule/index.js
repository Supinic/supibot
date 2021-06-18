module.exports = {
	Name: "schedule",
	Aliases: null,
	Author: "supinic",
	Cooldown: 30000,
	Description: "Posts the channel's stream schedule.",
	Flags: ["external-input","mention","non-nullable","opt-out","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function schedule (context, channel) {
		let channelName = null;
		if (channel) {
			channelName = channel;
		}
		else if (context.platform.Name === "twitch" && context.channel) {
			channelName = context.channel.Name;
		}

		if (!channelName) {
			return {
				success: false,
				reply: `No channel provided, and there is no default channel to be used!`
			};
		}

		const channelID = await sb.Utils.getTwitchID(channelName);
		if (!channelID) {
			return {
				success: false,
				reply: `Provided user does not exist on Twitch!`
			};
		}

		const response = await sb.Got("Helix", {
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

		const { segments, vacation } = response.body.data;
		if (vacation !== null) {
			const start = new sb.Date(vacation.start_time);
			const end = new sb.Date(vacation.end_time);

			const [firstSeg] = segments;
			const firstSegStart = new sb.Date(firstSeg.start_time);
			const firstSegEnd = new sb.Date(firstSeg.end_time);

			// Only mention the vacation if it affects the first segment in the list, and only if it hasn't ended yet.
			if (firstSegStart > start && firstSegEnd < end && end > sb.Date.now()) {
				const verb = (start < sb.Date.now()) ? "started" : "starts";
				return {
					reply: sb.Utils.tag.trim `
						Streaming schedule is interrupted.
						Vacation ${verb} on ${start.format("Y-m-d")} 
						and ends ${sb.Utils.timeDelta(end)}.
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
			const firstSegmentStart = new sb.Date(segments[0].start_time);
			if (firstSegmentStart < sb.Date.now()) { // First stream segment should already be underway
				const liveData = await sb.Got("Kraken", `streams/${channelID}`).json();
				const isLive = Boolean(liveData.stream);

				if (!isLive) { // Stream is not live - use the first segment (when it should have started), and mention that stream is late
					const emote = await context.getBestAvailableEmote(["Weirdga", "WeirdChamp", "FeelsWeirdMan"], "🤨");
					lateString = `The stream seems to be late ${emote}`;

					segment = segments[0];
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

		let ownStreamString = "";
		let target = `${channelName}'s`;
		if (channelName.toLowerCase() === context.user.Name) {
			target = "Your";
			ownStreamString = "(shouldn't you know when you're supposed to stream? 😉)";
		}

		const time = sb.Utils.timeDelta(new sb.Date(segment.start_time));
		return {
			reply: sb.Utils.tag.trim `
				${target} next stream:
				${game} - ${title},
				starting ${time}.
				${lateString} 
				${ownStreamString}
			`
		};
	}),
	Dynamic_Description: null
};
