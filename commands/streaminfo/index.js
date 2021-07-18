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
		let targetChannel;
		if (args.length === 0) {
			if (context.platform.Name !== "twitch") {
				return {
					success: false,
					reply: `No Twitch channel provided!`
				};
			}
			else if (context.privateMessage) {
				return {
					success: false,
					reply: `No channel provided!`
				};
			}

			targetChannel = context.channel.Name;
		}
		else {
			targetChannel = args[0];
		}

		const { controller } = sb.Platform.get("twitch");
		const targetData = await sb.User.get(targetChannel);
		const channelID = targetData?.Twitch_ID ?? await controller.getUserID(targetChannel);
		if (!channelID) {
			return {
				success: false,
				reply: "There is no Twitch channel with that name!"
			};
		}

		const data = await sb.Got("Kraken", `streams/${channelID}`).json();
		if (data === null || data.stream === null) {
			const broadcasterData = await sb.Got("Leppunen", `v2/twitch/user/${targetChannel}`);
			const { lastBroadcast } = broadcasterData.body;
			if (lastBroadcast.startedAt === null) {
				return {
					reply: `Channel is offline - never streamed before.`
				};
			}

			const start = new sb.Date(lastBroadcast.startedAt);
			const title = lastBroadcast.title ?? "(no title)";
			const delta = sb.Utils.timeDelta(start, true);

			return {
				reply: `Channel is offline - last streamed ${delta}, title: ${title}`
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
				${targetChannel} is ${broadcast}, 
				since ${started} 
				for ${sb.Utils.groupDigits(stream.viewers)} viewer${viewersSuffix}
				at ${stream.video_height}p.
				Title: ${stream.channel.status} 
				https://twitch.tv/${targetChannel.toLowerCase()}
			`
		};
	}),
	Dynamic_Description: null
};
