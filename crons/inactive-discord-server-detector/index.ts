import { SupiDate } from "supi-core";
import type { CronDefinition } from "../index.js";

// eslint-disable-next-line @typescript-eslint/no-deprecated
const sanitize = (string: string) => string.replaceAll(/\p{Emoji}/gu, (match) => escape(match).replaceAll("%", "\\"));

export default {
	name: "inactive-discord-server-detector",
	expression: "0 0 12 * * 2",
	description: "Logs the amount of currently active chatters. Runs every Tuesday, at 12:00 (noon)",
	code: (async function detectInactiveDiscordServers () {
		const platform = sb.Platform.get("discord");
		if (!platform) {
			this.stop();
			return;
		}

		const discord = platform.client;
		const botChannels = sb.Channel.getJoinableForPlatform("discord");

		const guildThreshold = 95;
		const guilds = await discord.guilds.fetch();
		if (guilds.size < guildThreshold) {
			return;
		}

		const messageThreshold = new SupiDate().addMonths(-3);
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
			const lastCommandExecuted = await core.Query.getRecordset<number>(rs => rs
				.select("IFNULL(MAX(Last_Command_Posted), 0) AS Last")
				.from("chat_data", "Meta_Channel_Command")
				.where("Channel IN %n+", channelIDs)
				.flat("Last")
				.single()
			);

			// Re-do the SupiDate construction, as the IFNULL function turns inputs into string.
			const checkDate = new SupiDate(lastCommandExecuted);
			if (checkDate >= messageThreshold) {
				continue;
			}

			const lastMessagePosted = await core.Query.getRecordset<SupiDate>(rs => rs
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
				joined: new SupiDate(guild.joinedTimestamp),
				lastMessagePosted,
				lastCommandExecuted,
				members: nonBotMembers.size,
				admins
			});
		}

		let message;
		const suggestion = await core.Query.getRow("data", "Suggestion");

		if (result.length === 0) {
			message = "No Discord guilds were found to be inactive this week :)";
		}
		else {
			let extra = "";
			const skip = new SupiDate("2022-08-01").valueOf();
			if (skip > SupiDate.now()) {
				extra = "(don't actually remove anything before 2022-08-01!)";
			}

			result.sort((a, b) => new SupiDate(a.lastCommandExecuted).valueOf() - new SupiDate(b.lastCommandExecuted).valueOf());

			message = `${extra} Found ${result.length} potentially inactive Discord guilds:\n\n${JSON.stringify(result, null, 4)}`;
		}

		suggestion.setValues({
			Text: message,
			User_Alias: 1127,
			Priority: 255
		});

		await suggestion.save({ skipLoad: true });
	})
} satisfies CronDefinition;
