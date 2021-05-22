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
	add: async (req, res, url) => {
		const channelName = url.searchParams.get("name");
		const platformName = url.searchParams.get("platform");
		const botChannelMode = url.searchParams.get("mode") ?? "Write";
		const announcement = url.searchParams.get("announcement") ?? null;

		if (!channelName || !platformName) {
			return {
				statusCode: 400,
				data: { message: "No channel or platform provided" }
			};
		}

		const platformData = sb.Platform.get(platformName);
		if (!platformData) {
			return {
				statusCode: 400,
				data: { message: "Invalid platform provided" }
			};
		}
		else if (!platformData.controller.dynamicChannelAddition) {
			return {
				statusCode: 400,
				data: { message: "Provided platform cannot dynamically add new channels" }
			};
		}

		const channelID = await platformData.controller.getUserID(channelName);
		if (!channelID) {
			return {
				success: false,
				reply: "Provided channel does not exist on the provided platform!"
			};
		}

		await sb.Channel.add(channelName, platformData, botChannelMode, channelID);
		await platformData.client.join(channelName);

		if (announcement) {
			const channelData = sb.Channel.get(channelName, platformData);
			await channelData.send(announcement);
		}

		return {
			statusCode: 200,
			data: { message: "Channel joined succesfully" }
		};
	},
	join: async (req, res, url) => partOrJoin("join", url),
	part: async (req, res, url) => partOrJoin("part", url)
};
