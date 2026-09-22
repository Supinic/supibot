import { SupiDate } from "supi-core";
import { defineChatModule } from "../../classes/chat-module.js";

const relaxedRegex = /(supi|supinic(?!\.com)|bupi|супи|супик.?|супиник.?)\b/i;
// const strictRegex = /\bsupinic(?!\.com)\b/i;
const skippedUserIds = [1, 1127, 582108, 8697460, 12182780, 17865963];

export default defineChatModule({
	name: "ping-supi",
	description: "This module notifies Supinic whenever he is mentioned (in any channel, across platforms) via Twitch whispers.",
	scope: "global",
	platform: "all",
	state: () => ({
		// consider using a Map<Channel, number> to prevent multi-pings per-channel instead of globally
		timestamp: 0
	}),
	handlers: {
		async message (context, { state }) {
			const { message, channel, user } = context;
			const now = SupiDate.now();

			if (state.timestamp > now) {
				return;
			}
			if (user?.ID && skippedUserIds.includes(user.ID)) {
				return;
			}
			if (!relaxedRegex.test(message)) {
				return;
			}

			const globalPingRemoved = await channel.getDataProperty("globalPingRemoved");
			if (globalPingRemoved) {
				return;
			}

			// const enforceStrictRegex = await channel.getDataProperty("globalPingStrictRegexOnly");
			// if (enforceStrictRegex && !strictRegex.test(message)) {
			// 	return;
			// }

			const twitchPlatform = sb.Platform.getAsserted("twitch");
			const userName = user?.Name ?? `❓${context.raw?.user ?? "(unknown)"}`;

			state.timestamp = now + 1000;

			const pingMessage = `[ ${channel.Description ?? channel.Name} ]: ${userName} : ${message}`;
			await twitchPlatform.pm(pingMessage, await sb.User.getAsserted("supinic"));
		}
	}
});
