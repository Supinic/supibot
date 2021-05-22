module.exports = {
	Name: "checkdeadchannels",
	Aliases: ["cdc"],
	Author: "supinic",
	Cooldown: 0,
	Description: "Iterates over active channels, takes the last posted message in each, and prints the dates + messages into a Pastebin paste. This is useful to determine if and which channels could potentially be removed from the bot because of prolonged inactivity.",
	Flags: ["pipe","skip-banphrase","system","whitelist"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function checkDeadChannels () {
		const promises = [];
		const regex = /^[^:]+$/;
		const channels = sb.Channel.data.filter(channel => (
			channel.Platform.Name === "twitch" && regex.test(channel.Name) && channel.Mode !== "Inactive"
		));
	
		for (const channel of channels) {
			const dbName = channel.getDatabaseName();
			promises.push((async () => {
				const data = await sb.Query.getRecordset(rs => rs
					.select("User_Alias.Name AS Name", "Posted", "Text")
					.from("chat_line", dbName)
					.join("chat_data", "User_Alias")
					.orderBy(`${dbName}.ID DESC`)
					.limit(1)
					.single()
				);
	
				if (!data) {
					return {
						Posted: new Date(0),
						stuff: "Nothing?",
						channel: channel.Name
					};
				}
	
				data.Channel = channel.Name;
				return data;
			})());
		}
	
		const results = (await Promise.all(promises)).filter(Boolean).sort((a, b) => a.Posted - b.Posted);
		const paste = await sb.Pastebin.post(JSON.stringify(results, null, 4));
		if (paste.success !== true) {
			return {
				success: false,
				reply: paste.error ?? paste.body
			};
		}

		return {
			reply: paste.body
		};
	}),
	Dynamic_Description: null
};
