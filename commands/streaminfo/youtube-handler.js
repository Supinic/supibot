const channelRegex = /^UC\w{22}$/;
module.exports = async function youtubeStreamInfoHandler (context) {
	let channelID;
	const input = context.params.youtube;

	if (channelRegex.test(input)) {
		channelID = input;
	}
	else {
		const channelResponse = await sb.Got("GenericAPI", {
			throwHttpErrors: false,
			responseType: "json",
			url: "https://www.googleapis.com/youtube/v3/channels",
			searchParams: {
				forUsername: context.params.youtube,
				key: sb.Config.get("API_GOOGLE_YOUTUBE")
			}
		});

		if (channelResponse.body.items.length === 0) {
			return {
				success: false,
				reply: sb.Utils.tag.trim `
					No channel found for that name!
					Try using the "real" channel name instead of its display name.
					You couldalso  try using the channel's ID directly.
				`
			};
		}

		channelID = channelResponse.body.items[0].id;
	}

	const streamResponse = await sb.Got("GenericAPI", {
		throwHttpErrors: false,
		responseType: "json",
		url: "https://www.googleapis.com/youtube/v3/search",
		searchParams: {
			part: "snippet",
			sort: "relevance",
			channelId: channelID,
			eventType: "live",
			type: "video",
			key: sb.Config.get("API_GOOGLE_YOUTUBE")
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
	const delta = sb.Utils.timeDelta(new sb.Date(snippet.publishTime));

	return {
		reply: sb.Utils.tag.trim `
			Channel ${snippet.channelTitle} is live:
			${snippet.title}
			https://youtu.be/${stream.id.videoId}
			(live since ${delta})
		`
	};
};
