module.exports = {
	Name: "streaminfo",
	Aliases: ["si","uptime"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts stream info about a Twitch channel.",
	Flags: ["external-input","mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function streamInfo (context, ...args) {
		const target = (args.length === 0)
			? context.channel.Name
			: args[0];

		const { controller } = sb.Platform.get("twitch");
		const targetData = await sb.User.get(target);
		const channelID = targetData?.Twitch_ID ?? await controller.getUserID(target);

		if (!channelID) {
			return {
				success: false,
				reply: "There is no Twitch channel with that name!"
			};
		}

		const data = await sb.Got("Kraken", `streams/${channelID}`).json();
		if (data === null || data.stream === null) {
			const { data } = await sb.Got("Helix", {
				url: "videos",
				searchParams: {
					user_id: channelID
				}
			}).json();

			if (data.length === 0) {
				return {
					reply: `Channel is offline.`
				};
			}

			let mult = 1000;
			const { created_at: created, duration } = data[0];
			const vodDuration = duration.split(/\D/).filter(Boolean).map(Number)
				.reverse()
				.reduce((acc, cur) => {
					acc += cur * mult;
					mult *= 60;
					return acc;
				}, 0);

			const delta = sb.Utils.timeDelta(new sb.Date(created).valueOf() + vodDuration, true);
			return {
				reply: `Channel has been offline for ${delta}.`
			};
		}

		const stream = data.stream;
		const started = sb.Utils.timeDelta(new sb.Date(stream.created_at));
		const viewersSuffix = (stream.viewers === 1) ? "" : "s";
		const broadcast = (stream.game)
			? `playing ${stream.game}`
			: `streaming under no category`;

		return {
			reply: sb.Utils.tag.trim `
				${target} is ${broadcast}, 
				since ${started} 
				for ${sb.Utils.groupDigits(stream.viewers)} viewer${viewersSuffix}
				at ${stream.video_height}p.
				Title: ${stream.channel.status} 
				https://twitch.tv/${target.toLowerCase()}
			`
		};
	}),
	Dynamic_Description: null
};
