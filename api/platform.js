// noinspection JSUnusedGlobalSymbols
module.exports = {
	discordGuildCount: async () => {
		const platformData = sb.Platform.get("discord");
		if (!platformData) {
			return {
				statusCode: 400,
				error: { message: "Bot is not connected to Discord" }
			};
		}

		const guilds = await platformData.client.guilds.fetch();
		return {
			statusCode: 200,
			data: {
				count: guilds.size
			}
		};
	}
};
