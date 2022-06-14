module.exports = {
	Name: "randomclip",
	Aliases: ["rc"],
	Author: "supinic",
	Cooldown: 30000,
	Description: "Posts a random clip from either the current channel or the specified channel.",
	Flags: ["mention","non-nullable","pipe","use-params"],
	Params: [
		{ name: "author", type: "string" },
		{ name: "dateFrom", type: "date" },
		{ name: "dateTo", type: "date" },
		{ name: "limit", type: "number" },
		{ name: "linkOnly", type: "boolean" },
		{ name: "period", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function randomClip (context, channelName) {
		const channel = channelName ?? context.channel?.Name;
		if (!channel && (context.privateMessage || context.platform.Name !== "twitch")) {
			return {
				success: false,
				reply: "You must specify the target channel if you're in PMs or not on Twitch!"
			};
		}

		const channelID = await sb.Platform.get("twitch").controller.getUserID(channel);
		if (!channelID) {
			return {
				success: false,
				reply: `No such channel exists!`
			};
		}

		const earliestDate = new sb.Date("2011-01-01");
		const now = new sb.Date();
		const dateRange = [earliestDate, now];

		if (context.params.dateFrom) {
			dateRange[0] = context.params.dateFrom;
		}
		if (context.params.dateTo) {
			dateRange[1] = context.params.dateTo;
		}
		if (context.params.period) {
			if (context.params.dateFrom || context.params.dateTo) {
				return {
					success: false,
					reply: `Cannot combine parameters "dateFrom" and/or "dateTo" with "period"!`
				};
			}

			switch (context.params.period) {
				case "day": {
					dateRange[0] = now.clone().addDays(-1);
					break;
				}

				case "week": {
					dateRange[0] = now.clone().addDays(-7);
					break;
				}

				case "month": {
					dateRange[0] = now.clone().addMonths(-1);
					break;
				}

				case "year": {
					dateRange[0] = now.clone().addYears(-1);
					break;
				}

				// No change, keep default date range
				case "all": break;

				default: return {
					success: false,
					reply: `Invalid clip creation period! Use one of: day, week, month, year, all`
				};
			}
		}

		if (dateRange[0] < earliestDate || dateRange[1] < earliestDate) {
			return {
				success: false,
				reply: `Your provided date range is out of bounds! Earliest date is 2011-01-01.`
			};
		}
		else if (dateRange[0] > now || dateRange[1] > now) {
			return {
				success: false,
				reply: `Your provided date range is out of bounds! Cannot use a date in the future.`
			};
		}

		const limit = context.params.limit ?? 100;
		if (!sb.Utils.isValidInteger(limit, 1)) {
			return {
				success: false,
				reply: `Invalid limit provided!`
			};
		}
		else if (limit > 100) {
			return {
				success: false,
				reply: `Provided limit is too high! (maximum is 100)`
			};
		}

		const response = await sb.Got("Helix", {
			url: "clips",
			searchParams: {
				started_at: dateRange[0].toISOString(),
				ended_at: dateRange[1].toISOString(),
				first: limit,
				broadcaster_id: channelID
			},
			throwHttpErrors: false
		});

		if (response.statusCode === 404) {
			return {
				success: false,
				reply: "That user does not exist!"
			};
		}
		else if (response.body.data.length === 0) {
			return {
				success: false,
				reply: "No clips found!"
			};
		}

		let clips = response.body.data;
		if (context.params.author) {
			const userID = await sb.Utils.getTwitchID(context.params.author);
			if (!userID) {
				return {
					success: false,
					reply: `No such user exists!`
				};
			}

			clips = clips.filter(i => i.creator_id === userID);
			if (clips.length === 0) {
				return {
					success: false,
					reply: `That user has not created any of the top ${limit} clips for this channel!`
				};
			}
		}

		const clip = sb.Utils.randArray(clips);
		if (context.params.linkOnly) {
			return {
				reply: clip.url
			};
		}

		const delta = sb.Utils.timeDelta(new sb.Date(clip.created_at));
		return {
			reply: `"${clip.title}" - ${clip.duration} sec, clipped by ${clip.creator_name}, ${delta}: ${clip.url}`
		};
	}),
	Dynamic_Description: (async (prefix) => [
		"Fetches a random clip in the current, or a provided channel.",
		"",

		`<code>${prefix}randomclip</code>`,
		`<code>${prefix}rc</code>`,
		"Posts a random clip out of the top 100 clips in the current channel.",
		"",

		`<code>${prefix}rc <u>(channel)</u></code>`,
		`<code>${prefix}rc <u>forsen</u></code>`,
		"Posts a random clip out of the top 100 clips in the channel you provided.",
		"",

		`<code>${prefix}rc <u>linkOnly:true</u></code>`,
		"Posts only the clip link, omitting all the info around it (like title, duration, creator, etc).",
		"",

		`<code>${prefix}rc <u>limit:(number)</u></code>`,
		`<code>${prefix}rc <u>limit:10</u></code>`,
		"Rather than posting a clip out of the top 100, you can limit the amount top clips to a lower number.",
		"The number must be in a range between 1 and 100.",
		"",

		`<code>${prefix}rc <u>author:(username)</u></code>`,
		`<code>${prefix}rc <u>author:ClipItAndShipIt</u></code>`,
		"Filters the top clips by their author, and then posts a random one.",
		"",

		`<code>${prefix}rc <u>period:(time frame)</u></code>`,
		`<code>${prefix}rc <u>period:month</u></code>`,
		"Filters the top clips by their creation time, using an option specifying the time frame.",
		"Available options: <code>day, week, month, year</code> - all from now, going back.",
		"This parameter cannot be used with either <code>dateFrom</code> or <code>dateTo</code>!",
		"",

		`<code>${prefix}rc <u>dateFrom:(date)</u> <u>dateTo:(date)</u></code>`,
		`<code>${prefix}rc <u>dateFrom:2022-01-01</u> <u>dateTo:2022-02-14</u></code>`,
		"Filters the top clips by their creation time, using specific dates.",
		"The dates cannot be earlier than 2011-01-01 (Twitch limit), or later than right now (no future clips).",
		"You can use both <code>dateFrom</code> and <code>dateTo</code>, or just one - in that case, the limit will be the limit mentioned above.",
		"This parameter cannot be used with <code>period!</code>"
	])
};
