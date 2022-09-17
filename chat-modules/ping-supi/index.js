module.exports = {
	Name: "ping-supi",
	Events: ["message"],
	Description: "This module notifies Supinic whenever he is mentioned (in any channel, across platforms) via Twitch whispers.",
	Code: (async function pingSupi (context) {
		const { message, channel, user } = context;

		this.data.timeout ??= 0;

		const relaxedRegex = /supi\b|supinic(?!\.com)|bupi|супи/i;
		const strictRegex = /\bsupinic(?!\.com)\b/i;

		const skippedUsers = [1, 1127, 8697460, 12182780];
		const now = sb.Date.now();

		if (now > this.data.timeout && relaxedRegex.test(message) && !skippedUsers.includes(user?.ID)) {
			if (channel) {
				let enforceStrictRegex = await channel.getDataProperty("globalPingRemoved");

				const platformData = channel.Platform;
				if (platformData.Name === "discord") {
					const discordChannel = await platformData.client.channels.fetch(channel.Name);
					const membersMap = discordChannel.members.cache ?? discordChannel.members;
					if (membersMap) {
						enforceStrictRegex = !membersMap.has("168719563741986816"); // @supinic discord ID
					}
				}

				if (enforceStrictRegex && !strictRegex.test(message)) {
					return;
				}
			}

			const platformData = sb.Platform.get("twitch");
			const userName = user?.Name ?? `❓${context.raw.user}`;

			this.data.timeout = now + 1000;

			const pingMessage = `[ ${channel.Description ?? channel.Name} ]: ${userName} : ${message}`;
			await platformData.client.whisper("supinic", pingMessage);
		}
	}),
	Global: true,
	Platform: null
};
