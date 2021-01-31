module.exports = {
	Name: "randomclip",
	Aliases: ["rc"],
	Author: "supinic",
	Cooldown: 30000,
	Description: "Posts a random clip from either the current channel or the specified channel. You can specify a parameter period, with options day/week/month/all, for example: period:week",
	Flags: ["link-only","mention","non-nullable","pipe","use-params"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function randomClip (context, ...args) {
		let channel = context.channel?.Name ?? null;
		if (args.length > 0 && !args[0].includes(":")) {
			channel = args[0];
		}
	
		if (!channel && (context.privateMessage || context.platform.Name !== "twitch")) {
			return {
				success: false,
				reply: "You must specify the target channel if you're in PMs or not on Twitch!"
			};
		}
	
		const period = context.params.period ?? "all";
		if (!["day", "week", "month", "all"].includes(period))  {
			return {
				success: false,
				reply: `Invalid clip creation period! Use one of: day, week, month, all`
			};
		}

		const { statusCode, body: data } = await sb.Got("Kraken", {
			url: "clips/top",
			searchParams: new sb.URLParams()
				.set("period", period)
				.set("channel", channel || context.channel.Name)
				.set("limit", "100")
				.toString(),
			throwHttpErrors: false
		});

		if (statusCode === 404) {
			return {
				success: false,
				reply: "That user does not exist!"
			};
		}
		else if (data.clips.length === 0) {
			return {
				reply: "No clips found!",
				link: null
			};
		}

		const clip = sb.Utils.randArray(data.clips);
		const delta = sb.Utils.timeDelta(new sb.Date(clip.created_at));
		const link = "https://clips.twitch.tv/" + clip.slug;
		return {
			reply: `${clip.title} - ${clip.duration} sec, clipped by ${clip.curator.name}, ${delta}: ${link}`,
			link
		};
	}),
	Dynamic_Description: null
};