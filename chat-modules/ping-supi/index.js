module.exports = {
	Name: "ping-supi",
	Events: ["message"],
	Description: "This module notifies Supinic whenever he is mentioned (in any channel, across platforms) via Twitch whispers.",
	Code: (async function pingSupi (context) {
		const { message, channel, user } = context;
		const regex = /supi\b|supinic(?!\.com)|bupi/i;
		const skippedUsers = [1, 1127];

		if (typeof this.data.timeout === "undefined") {
			this.data.timeout = 0;
		}

		const now = sb.Date.now();
		if (now > this.data.timeout && regex.test(message) && !skippedUsers.includes(user?.ID)) {
			const userName = user?.Name ?? `❓${context.raw.user}`;

			this.data.timeout = now + 1000;

			const pingMessage = `[#${channel.Description ?? channel.Name}] ${userName}: ${message}`;
			await sb.Platform.get("twitch").pm(pingMessage, await sb.User.get("supinic"));
		}
	}),
	Author: "supinic"
};
