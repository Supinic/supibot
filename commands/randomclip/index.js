module.exports = {
	Name: "randomclip",
	Aliases: ["rc"],
	Author: "supinic",
	Cooldown: 30000,
	Description: "Posts a random clip from either the current channel or the specified channel. You can specify a parameter period, with options day/week/month/all, for example: period:week",
	Flags: ["mention","non-nullable","pipe","use-params"],
	Params: [
		{ name: "linkOnly", type: "boolean" },
		{ name: "period", type: "string" }
	],
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
				success: false,
				reply: "No clips found!"
			};
		}
	
		const clip = sb.Utils.randArray(data.clips);
		const link = "https://clips.twitch.tv/" + clip.slug;
		if (context.params.linkOnly) {
			return {
				reply: link
			};
		}

		const delta = sb.Utils.timeDelta(new sb.Date(clip.created_at));
		return {
			reply: `${clip.title} - ${clip.duration} sec, clipped by ${clip.curator.name}, ${delta}: ${link}`,
		};
	}),
	Dynamic_Description: null
};