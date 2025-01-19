// noinspection JSUnusedGlobalSymbols
export default {
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
		else if (!platformData.dynamicChannelAddition) {
			return {
				statusCode: 400,
				data: { message: "Provided platform cannot dynamically add new channels" }
			};
		}

		const channelID = await platformData.getUserID(channelName);
		if (!channelID) {
			return {
				statusCode: 400,
				data: { message: "Provided platform cannot dynamically add new channels" }
			};
		}

		const newChannelData = await sb.Channel.add(channelName, platformData, botChannelMode, channelID);
		await platformData.joinChannel(channelID);

		if (announcement) {
			await newChannelData.send(announcement);
		}

		return {
			statusCode: 200,
			data: { message: "Channel joined succesfully" }
		};
	},
	stats: async () => {
		let total = 0;
		const platformStats = {};

		for (const [platformData, platformMap] of sb.Channel.data.entries()) {
			if (!platformData) {
				continue;
			}

			for (const channelData of platformMap.values()) {
				if (channelData.Mode === "Inactive") {
					continue;
				}

				platformStats[platformData.Name] ??= 0;
				platformStats[platformData.Name]++;
				total++;
			}
		}

		return {
			statusCode: 200,
			data: {
				platforms: platformStats,
				total
			}
		};
	},
	send: async (req, res, url) => {
		const channelName = url.searchParams.get("name");
		const platformName = url.searchParams.get("platform");
		const message = url.searchParams.get("message");

		if (!channelName || !platformName || !message) {
			return {
				statusCode: 400,
				data: { message: "Missing one or more required params: name, platform, message" }
			};
		}

		const platformData = sb.Platform.get(platformName);
		if (!platformData) {
			return {
				statusCode: 400,
				data: { message: "Invalid platform provided" }
			};
		}

		const channelData = sb.Channel.get(channelName, platformData);
		if (!channelData) {
			return {
				statusCode: 400,
				data: { message: "Invalid channel provided" }
			};
		}

		await channelData.send(message);

		return {
			statusCode: 200,
			data: { message: "OK" }
		};
	}
};
