module.exports = {
	Name: "pingall",
	Aliases: null,
	Author: "supinic",
	Cooldown: 0,
	Description: "Attempts to check all channel bots by using their ping commands.",
	Flags: ["developer","pipe","skip-banphrase","whitelist"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function pingAll (context) {
		const bots = await sb.Query.getRecordset(rs => rs
			.select("Bot_Alias", "Prefix", "Prefix_Space")
			.from("bot_data", "Bot")
			.where("Prefix IS NOT NULL")
			.where("Prefix <> %s", sb.Command.prefix)
		);
	
		for (const bot of bots) {
			const space = bot.Prefix_Space ? " " : "";
			context.channel.send(`${bot.Prefix}${space}ping`);
		}
	
		return null;
	}),
	Dynamic_Description: null
};