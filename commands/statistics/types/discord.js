module.exports = {
	name: "discord",
	aliases: [],
	description: "Posts a summary of Discord-related statistics",
	execute: async (/* context , type */) => {
		const { client } = sb.Platform.get("discord");
		const guilds = await client.guilds.fetch();

		return {
			reply: `Supibot is currently available on ${guilds.size}/100 Discord servers.`
		};
	}
};
