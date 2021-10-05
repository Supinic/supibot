module.exports = {
	Name: "randomclip",
	Aliases: ["rc"],
	Author: "supinic",
	Cooldown: 30000,
	Description: "Posts a random clip from either the current channel or the specified channel. You can specify a parameter period, with options day/week/month/all, for example: period:week",
	Flags: ["mention","non-nullable","pipe","use-params"],
	Params: [
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

		if (context.params.period) {
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

				// No change, keep default date range
				case "all": break;

				default: return {
					success: false,
					reply: `Invalid clip creation period! Use one of: day, week, month, all`
				};
			}
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
		else if (response.body.length === 0) {
			return {
				success: false,
				reply: "No clips found!"
			};
		}

		const clip = sb.Utils.randArray(response.body);
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
	Dynamic_Description: null
};
