const partOrJoin = (type, url) => {
	const platformData = sb.Platform.get(url.searchParams.get("platform") ?? "twitch");
	const channels = url.searchParams.getAll("channel");
	const channelsData = [];

	for (const channel of channels) {
		const channelData = sb.Channel.get(channel, platformData);
		if (!channelData) {
			return {
				statusCode: 404,
				error: { message: `Channel "${channel}" not found` }
			};
		}
		else if (channelData.Platform.Name !== "twitch") {
			return {
				statusCode: 400,
				error: { message: `Cannot part non-Twitch channel "${channel}"` }
			};
		}

		const joined = channelData.sessionData?.joined ?? true;
		if (joined === true && type === "join") {
			return {
				statusCode: 400,
				error: { message: `Cannot join channel "${channel}" - already joined` }
			};
		}
		else if (joined === false && type === "part") {
			return {
				statusCode: 400,
				error: { message: `Cannot part channel "${channel}" - already parted` }
			};
		}

		channelsData.push(channelData);
	}

	for (const channelData of channelsData) {
		if (type === "join") {
			platformData.client.join(channelData.Name);
		}
		else if (type === "part") {
			platformData.client.part(channelData.Name);
		}
	}

	return {
		statusCode: 200,
		data: { message: "OK" }
	};
};

// noinspection JSUnusedGlobalSymbols
module.exports = {
	reloadAll: async () => {
		await sb.Channel.reloadData();
		return {
			statusCode: 200,
			data: { message: "OK" }
		};
	},
	join: async (req, res, url) => partOrJoin("join", url),
	part: async (req, res, url) => partOrJoin("part", url)
};