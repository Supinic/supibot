module.exports = {
	Name: "inactive-discord-server-detector",
	Expression: "0 0 12 * * 2",
	Description: "Logs the amount of currently active chatters.",
	Defer: null,
	Type: "Bot",
	Code: (async function detectInactiveDiscordServers () {
		// Runs every Tuesday, at 12:00 (noon)
		const discord = sb.Platform.get("discord").client;
		const botChannels = sb.Channel.getJoinableForPlatform("discord");

		const messageThreshold = new sb.Date().addMonths(-3);
		const guilds = await discord.guilds.fetch();

		const sanitize = (string) => string.replace(/\p{Emoji}/gu, (match) => escape(match).replaceAll("%", "\\"));

		const result = [];
		for (const guildData of guilds.values()) {
			const guild = await discord.guilds.fetch(guildData.id);
			const guildChannels = botChannels.filter(i => i.Specific_ID === guild.id);
			const channelIDs = guildChannels.map(i => i.ID);

			const lastCommandExecuted = await sb.Query.getRecordset(rs => rs
				.select("MAX(Executed) AS Last_Command_Executed")
				.from("chat_data", "Command_Execution")
				.where("Channel IN %n+", channelIDs)
				.flat("Last_Command_Executed")
				.single()
			);

			if (lastCommandExecuted && lastCommandExecuted >= messageThreshold) {
				continue;
			}
			const lastMessagePosted = await sb.Query.getRecordset(rs => rs
				.select("MAX(Last_Message_Posted) AS Last_Message_Executed")
				.from("chat_data", "Message_Meta_User_Alias")
				.where("Channel IN %n+", channelIDs)
				.flat("Last_Message_Executed")
				.single()
			);

			const members = await guild.members.fetch();
			const nonBotMembers = members.filter(i => !i.user.bot);
			const admins = nonBotMembers
				.filter(i => i.permissions.has("ADMINISTRATOR"))
				.map(i => `${sanitize(i.user.username)} (${i.user.id})`);

			result.push({
				guild: {
					name: sanitize(guild.name),
					id: guild.id
				},
				joined: new sb.Date(guild.joinedTimestamp),
				lastMessagePosted,
				lastCommandExecuted,
				members: nonBotMembers.size,
				admins
			});
		}

		let message;
		const suggestion = await sb.Query.getRow("data", "Suggestion");

		if (result.length === 0) {
			message = "No Discord guilds were found to be inactive this week :)";
		}
		else {
			let extra = "";
			const skip = new sb.Date("2022-08-01");
			if (skip > sb.Date.now()) {
				extra = "(don't actually remove anything before 2022-08-01!)";
			}

			result.sort((a, b) => new sb.Date(a.lastCommandExecuted) - new sb.Date(b.lastCommandExecuted));

			message = `${extra} Found ${result.length} potentially inactive Discord guilds:\n\n${JSON.stringify(result, null, 4)}`;
		}

		suggestion.setValues({
			Text: message,
			User_Alias: 1127,
			Priority: 255
		});

		await suggestion.save({ skipLoad: true });
	})
};
