import { defineChatModule } from "../../classes/chat-module.js";

const REPLY_EMOTES = ["pajaS", "pajaW", "pajaH", "pajaScoots", "pajaL", "monkaS", "paaaajaW", "Okayga", "PAJAW", "paaaajaW"];

export default defineChatModule({
	name: "pajbot-raffle-joiner",
	description: "Conditionally joins points raffles initiated by Pajbot",
	platform: ["twitch"],
	scope: "channel",
	state: () => ({ timestamp: 0 }),
	handlers: {
		async message (context, { state }) {
			if (context.user?.Name !== "pajbot") {
				return;
			}

			const { message } = context;
			if (!message.includes("type") && !message.includes("!join") && !message.includes("will end")) {
				return;
			}

			const points = Number(message.match(/(-?\d+)\s+points/)?.[1]);
			if (!points || points < 5000) {
				return;
			}

			const now = Date.now();
			if (state.timestamp > now) {
				return;
			}

			state.timestamp = now + 30_000;
			const replyTimeout = core.Utils.random(2500, 20_000);
			const emote = await context.platform.getBestAvailableEmote(context.channel, REPLY_EMOTES, ":)");

			setTimeout(() => void context.channel.send(`!join ${emote}`), replyTimeout);
		}
	}
});
