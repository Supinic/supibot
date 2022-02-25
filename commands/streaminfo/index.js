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
			targetChannel = sb.Channel.normalizeName(args[0]);
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

		const streamResponse = await sb.Got("Helix", {
			url: "streams",
			searchParams: {
				user_id: channelID
			}
		});

		const [stream] = streamResponse.body.data;
		if (!stream) {
			const broadcasterData = await sb.Got("Leppunen", {
				url: `v2/twitch/user/${channelID}`,
				searchParams: {
					id: "true"
				}
			});

			if (broadcasterData.statusCode !== 200) {
				return {
					reply: `Channel is offline - no more data currently available. Try again later`
				};
			}

			const { banned, lastBroadcast } = broadcasterData.body;
			const status = (banned) ? "banned" : "offline";
			if (lastBroadcast.startedAt === null) {
				return {
					reply: `Channel is ${status} - never streamed before.`
				};
			}

			const start = new sb.Date(lastBroadcast.startedAt);
			const title = lastBroadcast.title ?? "(no title)";
			const delta = sb.Utils.timeDelta(start);

			return {
				reply: `Channel is ${status} - last streamed ${delta}, title: ${title}`
			};
		}

		const tags = [];
		if (Array.isArray(stream.tag_ids) && stream.tag_ids.length !== 0) {
			const { URLSearchParams } = require("url");

			const paramsIterable = stream.tag_ids.map(i => ["tag_id", i]);
			const searchParams = new URLSearchParams(paramsIterable);

			const response = await sb.Got("Helix", {
				url: "tags/streams",
				searchParams
			});

			const tagDescriptions = response.body.data.map(i => i.localization_names["en-us"]);
			tags.push(...tagDescriptions);
		}

		const started = sb.Utils.timeDelta(new sb.Date(stream.started_at));
		const viewersSuffix = (stream.viewer_count === 1) ? "" : "s";
		const broadcast = (stream.game_name)
			? `playing ${stream.game_name}`
			: `streaming under no category`;
		const tagString = (tags.length === 0)
			? ""
			: `Current tags: ${tags.join(", ")}`;

		return {
			reply: sb.Utils.tag.trim `
				${targetChannel} is ${broadcast}, 
				since ${started} 
				for ${sb.Utils.groupDigits(stream.viewer_count)} viewer${viewersSuffix}.
				Title: ${stream.title} 
				${tagString}
				https://twitch.tv/${targetChannel.toLowerCase()}
			`
		};
	}),
	Dynamic_Description: null
};
