export const definition = {
	name: "inactive-discord-server-detector",
	expression: "0 0 12 * * 2",
	description: "Logs the amount of currently active chatters.",
	code: (async function detectInactiveDiscordServers () {
		// Runs every Tuesday, at 12:00 (noon)

		/** @type {DiscordPlatform} */
		const platform = sb.Platform.get("discord");
		const discord = platform.client;
		const botChannels = sb.Channel.getJoinableForPlatform("discord");

		const guildThreshold = 95;
		const guilds = await discord.guilds.fetch();
		if (guilds.size < guildThreshold) {
			return;
		}

		const sanitize = (string) => string.replace(/\p{Emoji}/gu, (match) => escape(match).replaceAll("%", "\\"));

		const messageThreshold = new sb.Date().addMonths(-3);
		const result = [];
		for (const guildData of guilds.values()) {
			const guild = await discord.guilds.fetch(guildData.id);
			const guildChannels = botChannels.filter(i => i.Specific_ID === guild.id);
			// In the future, also check guilds with 0 channels - the bot is possibly restricted from all of them
			if (guildChannels.length === 0) {
				continue;
			}
			else if (guildChannels.some(i => i.Mirror !== null)) {
				continue;
			}

			const channelIDs = guildChannels.map(i => i.ID);
			const lastCommandExecuted = await sb.Query.getRecordset(rs => rs
				.select("IFNULL(Last_Command_Posted, 0) AS Last")
				.from("chat_data", "Meta_Channel_Command")
				.where("Channel IN %n+", channelIDs)
				.flat("Last")
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
				.filter(i => i.permissions.has(platform.permissions.Administrator))
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
