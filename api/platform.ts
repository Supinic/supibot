import type { ApiDefinition } from "./index.js";

export default {
	list: () => {
		const platforms = sb.Platform.getList();
		const data = platforms.map(i => ({
			ID: i.ID,
			name: i.name,
			host: i.host ?? null,
			active: i.active,
			selfId: i.selfId,
			selfName: i.selfName
		}));

		return {
			statusCode: 200,
			data
		};
	},

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
} satisfies ApiDefinition;
