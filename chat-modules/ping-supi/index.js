module.exports = {
	Name: "ping-supi",
	Events: ["message"],
	Description: "This module notifies Supinic whenever he is mentioned (in any channel, across platforms) via Twitch whispers.",
	Code: (async function pingSupi (context) {
		const { message, channel, user } = context;

		const regex = /supi\b|supinic(?!\.com)|bupi/i;
		const skippedUsers = [1, 1127, 8697460, 12182780];

		if (typeof this.data.timeout === "undefined") {
			this.data.timeout = 0;
		}

		const now = sb.Date.now();
		if (now > this.data.timeout && regex.test(message) && !skippedUsers.includes(user?.ID)) {
			if (channel) {
				const skip = await channel.getDataProperty("globalPingRemoved");
				if (skip) {
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
