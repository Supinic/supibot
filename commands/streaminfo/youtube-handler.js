const channelRegex = /^UC\w{22}$/;
export default async function youtubeStreamInfoHandler (context) {
	if (!process.env.API_GOOGLE_YOUTUBE) {
		throw new sb.Error({
			message: "No YouTube API key configured (API_GOOGLE_YOUTUBE)"
		});
	}

	let channelID;
	const input = context.params.youtube;

	if (channelRegex.test(input)) {
		channelID = input;
	}
	else {
		const channelResponse = await core.Got.get("GenericAPI")({
			throwHttpErrors: false,
			responseType: "json",
			url: "https://www.googleapis.com/youtube/v3/search",
			searchParams: {
				q: input,
				order: "relevance",
				type: "channel",
				key: process.env.API_GOOGLE_YOUTUBE
			}
		});

		if (channelResponse.body.items.length === 0) {
			return {
				success: false,
				reply: core.Utils.tag.trim `
					No channel found for that name!
					Try using the "real" channel name instead of its display name.
					You could also try using the channel's ID directly.
				`
			};
		}

		channelID = channelResponse.body.items[0].id.channelId;
	}

	const streamResponse = await core.Got.get("GenericAPI")({
		throwHttpErrors: false,
		responseType: "json",
		url: "https://www.googleapis.com/youtube/v3/search",
		searchParams: {
			part: "snippet",
			order: "relevance",
			channelId: channelID,
			eventType: "live",
			type: "video",
			key: process.env.API_GOOGLE_YOUTUBE
		}
	});

	if (streamResponse.statusCode !== 200) {
		return {
			success: false,
			reply: `Invalid channel provided!`
		};
	}

	const { items } = streamResponse.body;
	if (items.length === 0) {
		return {
			reply: `Channel is currently offline.`
		};
	}

	const [stream] = items;
	const { snippet } = stream;
	const delta = core.Utils.timeDelta(new sb.Date(snippet.publishTime));

	return {
		reply: core.Utils.tag.trim `
			Channel ${snippet.channelTitle} is live:
			${core.Utils.fixHTML(snippet.title)}
			https://youtu.be/${stream.id.videoId}
			(live since ${delta})
		`
	};
};
