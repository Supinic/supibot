module.exports = {
	Name: "streaminfo",
	Aliases: ["si","uptime"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts stream info about a Twitch channel. Also supports YouTube - check the help article.",
	Flags: ["external-input","mention","non-nullable","pipe"],
	Params: [
		{ name: "summary", type: "boolean" },
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

		if (context.params.summary) {
			const response = await sb.Got("TwitchGQL", {
				body: JSON.stringify([{
					operationName: "HomeShelfGames",
					extensions: {
						persistedQuery: {
							version: 1,
							sha256Hash: "cb7711739c2b520ebf89f3027863c0f985e8094df91cc5ef28896d57375a9700"
						}
					},
					variables: {
						channelLogin: targetChannel
					}
				}])
			});

			const { user } = response.body[0].data;
			if (!user) {
				return {
					success: false,
					reply: `Summary data is not available! Channel is probably banned or inactive.`
				};
			}

			const edges = user.channel.home.shelves.categoryShelf.edges ?? [];
			if (edges.length === 0) {
				return {
					success: false,
					reply: `That channel did not stream in any category recently!`
				};
			}

			const games = edges.filter(i => i.node?.displayName).map(i => i.node.displayName).join(", ");
			return {
				reply: `Recently streamed categories: ${games}`
			};
		}

		const streamResponse = await sb.Got("Helix", {
			url: "streams",
			searchParams: {
				user_id: channelID
			}
		});

		if (streamResponse.statusCode !== 200) {
			return {
				success: false,
				reply: `Cannot check for stream info! Try again later.`
			};
		}

		let vodString = "";
		const [stream] = streamResponse.body.data;
		const vodResponse = await sb.Got("Helix", {
			url: "videos",
			searchParams: {
				user_id: channelID
			}
		});

		const vod = vodResponse.body;
		if (vod.data && vod.data.length !== 0) {
			const data = vod.data[0];
			if (stream) {
				const offset = 90; // Implicitly offset the VOD by several seconds, to account for inaccuracies
				const stamp = sb.Utils.parseDuration(data.duration, { target: "sec" }) - offset;
				vodString = `${data.url}?t=${(stamp < 0) ? 0 : stamp}s`;
			}
			else {
				vodString = `${data.url}`;
			}
		}

		if (!stream) {
			const broadcasterResponse = await sb.Got("Leppunen", {
				url: "v2/twitch/user",
				searchParams: {
					id: channelID
				}
			});

			if (broadcasterResponse.statusCode !== 200 || broadcasterResponse.body.length === 0) {
				return {
					reply: `Channel
			} is offline - no more data currently available. Try again later`
				};
			}

			const [broadcasterData] = broadcasterResponse.body;
			const { banned, banReason, lastBroadcast } = broadcasterData;

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
				reply: `Channel is ${status} - last streamed ${delta} - title: ${title} ${vodString}`
			};
		}
		else {
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
					${vodString}
				`
			};
		}
	}),
	Dynamic_Description: (async (prefix) => [
		"Fetches the live status of a Twitch or YouTube channel.",
		"",

		`<code>${prefix}streaminfo (channel)</code>`,
		`<code>${prefix}streaminfo forsen</code>`,
		`Posts info about a Twitch channel's stream.`,
		`If it is live - posts info about the stream, and details.`,
		`If not currently live - posts info about the previous stream.`,
		"",

		`<code>${prefix}streaminfo (channel) <u>summary:true</u></code>`,
		`<code>${prefix}streaminfo forsen <u>summary:true</u></code>`,
		`Posts a list of recently streamed games and categories for a given channel.`,
		"",

		`<code>${prefix}streaminfo <u>youtube:(channel name)</u></code>`,
		`<code>${prefix}streaminfo <u>youtube:(channel id)</u></code>`,
		`Posts info about a YouTube channel's stream`,
		`You can use the channel name (watch out - name, not display name), or the channel ID directly`,
		`If the channel has multiple live streams at the same time, this command only posts the more relevant one.`
	])
};
