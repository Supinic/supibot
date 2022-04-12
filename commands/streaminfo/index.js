module.exports = {
	Name: "streaminfo",
	Aliases: ["si","uptime"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts stream info about a Twitch channel. Also supports YouTube - check the help article.",
	Flags: ["external-input","mention","non-nullable","pipe","use-params"],
	Params: [
		{ name: "youtube", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function streamInfo (context, ...args) {
		if (context.params.youtube) {
			const handler = require("./youtube-handler.js");
			return await handler(context, ...args);
		}

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

			const { banned, banReason, lastBroadcast } = broadcasterData.body;
			const status = (banned)
				? `banned (${banReason})`
				: "offline";

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
	Dynamic_Description: (async (prefix) => [
		"Fetches the live status of a Twitch or YouTube channel.",
		"",

		`<code>${prefix}$streaminfo (channel)</code>`,
		`Posts info about a Twitch channel's stream.`,
		`If it is live - posts info about the stream, and details.`,
		`If not currently live - posts info about the previous stream.`,
		"",

		`<code>${prefix}$streaminfo <u>youtube:(channel name)</u></code>`,
		`<code>${prefix}$streaminfo <u>youtube:(channel id)</u></code>`,
		`Posts info about a YouTube channel's stream`,
		`You can use the channel name (watch out - name, not display name), or the channel ID directly`,
		`If the channel has multiple live streams at the same time, this command only posts the more relevant one.`
	])
};
