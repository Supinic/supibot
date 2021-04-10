const partOrJoin = (type, url) => {
	const platformData = sb.Platform.get(url.searchParams.get("platform") ?? "twitch");
	const channels = url.searchParams.getAll("channel").map(i => sb.Channel.get(i, platformData));

	for (const channelData of channels) {
		if (!channelData) {
			return {
				statusCode: 404,
				error: { message: "Channel not found" }
			};
		}
		else if (channelData.Platform.Name !== "twitch") {
			return {
				statusCode: 400,
				error: { message: "Cannot part channels outside of Twitch" }
			};
		}
	}

	for (const channelData of channels) {
		if (type === "join") {
			platformData.client.join(channelData.Name);
		}
		else if (type === "part") {
			platformData.client.part(channelData.Name);
		}
	}

	return {
		statusCode: 200,
		body: { message: "OK" }
	};
};

// noinspection JSUnusedGlobalSymbols
module.exports = {
	reloadAll: async () => {
		await sb.Channel.reloadData();
		return {
			statusCode: 200,
			body: { message: "OK" }
		};
	},
	join: async (req, res, url) => partOrJoin("join", url),
	part: async (req, res, url) => partOrJoin("part", url)
};