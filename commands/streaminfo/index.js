module.exports = {
	Name: "streaminfo",
	Aliases: ["si","uptime"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts stream info about a Twitch channel.",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function streamInfo (context, ...args) {
		const target = (args.length === 0)
			? context.channel.Name
			: args[0];
	
		const targetData = await sb.User.get(target);
		const channelID = targetData?.Twitch_ID ?? await sb.Utils.getTwitchID(target);
	
		if (!channelID) {
			return {
				success: false,
				reply: "There is no Twitch channel with that name!"
			};
		}
	
		const data = await sb.Got.instances.Twitch.Kraken("streams/" + channelID).json();
		if (data === null || data.stream === null) {
			const { data } = await sb.Got.instances.Twitch.Helix({
				url: "videos",
				searchParams: "user_id=" + channelID
			}).json();
	
			if (data.length === 0) {
				return {
					reply: `Channel is offline.`
				};
			}
	
			let mult = 1000;
			const { created_at: created, duration } = data[0];
			const vodDuration = duration.split(/\D/).filter(Boolean).map(Number).reverse().reduce((acc, cur) => {
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
		const broadcast = (stream.game) 
			? `playing ${stream.game}`
			: `streaming under no category`; 
			
		return {
			reply: `${target} is ${broadcast}, since ${started} for ${stream.viewers} viewers at ${stream.video_height}p. Title: ${stream.channel.status} https://twitch.tv/${target.toLowerCase()}`
		};
	}),
	Dynamic_Description: null
};